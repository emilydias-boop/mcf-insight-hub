
-- Dedup: quando o webhook Hubla emite dois eventos (NewSale + invoice.payment_succeeded)
-- para a mesma venda, ambos são inseridos em hubla_transactions com ids distintos,
-- fazendo o trigger criar dois títulos. Passamos a considerar como phantom também
-- a linha com offer_name IS NULL quando existe outra linha com o mesmo offer_id
-- (mesma fatura Hubla) já com offer_name preenchido.

CREATE OR REPLACE FUNCTION public.ar_create_from_hubla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_titulo_id uuid;
  v_tipo text;
  v_status text;
  v_is_phantom boolean;
  v_n int;
  v_valor_parcela numeric;
  v_valor_ultima numeric;
  v_soma numeric;
  i int;
  v_venc date;
  v_ref numeric;
  v_key text;
  v_existing_titulo record;
  v_next_parcela record;
  v_num_max int;
  v_valor_pago_total numeric;
  v_valor_pendente numeric;
  v_parcelas_extras int;
  v_venc_base date;
BEGIN
  IF coalesce(NEW.sale_status,'') NOT IN ('completed','paid','approved') THEN
    RETURN NEW;
  END IF;

  v_code := NULL;
  IF NEW.product_name ILIKE 'A001%' THEN v_code := 'A001';
  ELSIF NEW.product_name ILIKE 'A002%' THEN v_code := 'A002';
  ELSIF NEW.product_name ILIKE 'A003%' THEN v_code := 'A003';
  ELSIF NEW.product_name ILIKE 'A004%' THEN v_code := 'A004';
  ELSIF NEW.product_name ILIKE 'A009%' THEN v_code := 'A009';
  END IF;

  IF v_code IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.ar_titulos WHERE hubla_transaction_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- ====================== Dedup Hubla (NewSale + invoice.payment_succeeded) ======================
  -- Se já existe um título para o mesmo cliente/produto criado nas últimas 24h a partir de
  -- OUTRA transação Hubla com o mesmo offer_id (mesma fatura), pula.
  IF coalesce(NEW.source,'') <> 'mcfpay' AND NEW.offer_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.ar_titulos t
      JOIN public.hubla_transactions h ON h.id = t.hubla_transaction_id
      WHERE t.product_code = v_code
        AND lower(coalesce(t.customer_email,'')) = lower(coalesce(NEW.customer_email,''))
        AND h.offer_id = NEW.offer_id
        AND h.id <> NEW.id
        AND abs(extract(epoch from (coalesce(t.sale_date, t.created_at) - coalesce(NEW.sale_date, now())))) < 86400
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- ====================== MCF PAY ======================
  IF coalesce(NEW.source,'') = 'mcfpay' THEN
    v_ref := public.ar_get_reference_price(v_code);
    v_key := lower(coalesce(NEW.customer_email, NEW.customer_phone, NEW.customer_name, ''));

    IF coalesce(NEW.product_price,0) >= v_ref * 0.95 AND v_ref > 0 THEN
      INSERT INTO public.ar_titulos (
        hubla_transaction_id, customer_name, customer_email, customer_phone, customer_document,
        product_name, product_code, valor_total, payment_method,
        total_installments_hubla, tipo, status, sale_date
      ) VALUES (
        NEW.id, coalesce(NEW.customer_name,'(sem nome)'), NEW.customer_email, NEW.customer_phone, NEW.customer_document,
        NEW.product_name, v_code, coalesce(NEW.product_price,0), coalesce(NEW.payment_method,'mcfpay'),
        1, 'integral', 'quitado', NEW.sale_date
      ) RETURNING id INTO v_titulo_id;

      INSERT INTO public.ar_parcelas (
        titulo_id, numero, tipo_parcela, valor, data_vencimento, status,
        valor_pago, data_pagamento, forma_pagamento
      ) VALUES (
        v_titulo_id, 1, 'parcela', coalesce(NEW.product_price,0),
        coalesce(NEW.sale_date::date, current_date), 'pago',
        coalesce(NEW.product_price,0), coalesce(NEW.sale_date::date, current_date), coalesce(NEW.payment_method,'mcfpay')
      );

      INSERT INTO public.ar_historico (titulo_id, tipo, descricao, valor)
      VALUES (v_titulo_id, 'criacao_automatica',
              'Título criado via MCF PAY (integral + baixado)', coalesce(NEW.product_price,0));
      RETURN NEW;
    END IF;

    SELECT * INTO v_existing_titulo
    FROM public.ar_titulos
    WHERE product_code = v_code
      AND status = 'aberto'
      AND tipo = 'parcelado'
      AND lower(coalesce(customer_email, customer_phone, customer_name, '')) = v_key
      AND coalesce(sale_date, created_at) > (now() - interval '12 months')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_titulo.id IS NOT NULL THEN
      SELECT * INTO v_next_parcela
      FROM public.ar_parcelas
      WHERE titulo_id = v_existing_titulo.id AND status = 'pendente'
      ORDER BY numero ASC
      LIMIT 1;

      IF v_next_parcela.id IS NOT NULL THEN
        UPDATE public.ar_parcelas
        SET status = 'pago',
            valor_pago = coalesce(NEW.product_price,0),
            data_pagamento = coalesce(NEW.sale_date::date, current_date),
            forma_pagamento = coalesce(NEW.payment_method,'mcfpay')
        WHERE id = v_next_parcela.id;
      ELSE
        SELECT coalesce(max(numero),0) INTO v_num_max FROM public.ar_parcelas WHERE titulo_id = v_existing_titulo.id;
        INSERT INTO public.ar_parcelas (
          titulo_id, numero, tipo_parcela, valor, data_vencimento, status,
          valor_pago, data_pagamento, forma_pagamento
        ) VALUES (
          v_existing_titulo.id, v_num_max + 1, 'parcela', coalesce(NEW.product_price,0),
          coalesce(NEW.sale_date::date, current_date), 'pago',
          coalesce(NEW.product_price,0), coalesce(NEW.sale_date::date, current_date), coalesce(NEW.payment_method,'mcfpay')
        );
      END IF;

      IF NOT EXISTS (SELECT 1 FROM public.ar_parcelas WHERE titulo_id = v_existing_titulo.id AND status <> 'pago' AND status <> 'cancelado') THEN
        UPDATE public.ar_titulos SET status = 'quitado' WHERE id = v_existing_titulo.id;
      END IF;

      INSERT INTO public.ar_historico (titulo_id, tipo, descricao, valor)
      VALUES (v_existing_titulo.id, 'baixa_mcfpay',
              'Parcela recebida via MCF PAY (consolidação automática)', coalesce(NEW.product_price,0));
      RETURN NEW;
    END IF;

    IF v_ref <= 0 THEN
      v_ref := coalesce(NEW.product_price,0) * 12;
    END IF;

    v_valor_pago_total := coalesce(NEW.product_price,0);
    v_valor_pendente := greatest(v_ref - v_valor_pago_total, 0);
    IF v_valor_pago_total > 0 AND v_valor_pendente > 0 THEN
      v_parcelas_extras := ceil(v_valor_pendente / v_valor_pago_total)::int;
    ELSE
      v_parcelas_extras := 0;
    END IF;

    INSERT INTO public.ar_titulos (
      hubla_transaction_id, customer_name, customer_email, customer_phone, customer_document,
      product_name, product_code, valor_total, payment_method,
      total_installments_hubla, tipo, status, sale_date
    ) VALUES (
      NEW.id, coalesce(NEW.customer_name,'(sem nome)'), NEW.customer_email, NEW.customer_phone, NEW.customer_document,
      NEW.product_name, v_code, v_ref, coalesce(NEW.payment_method,'mcfpay'),
      1 + v_parcelas_extras, 'parcelado', 'aberto', NEW.sale_date
    ) RETURNING id INTO v_titulo_id;

    INSERT INTO public.ar_parcelas (
      titulo_id, numero, tipo_parcela, valor, data_vencimento, status,
      valor_pago, data_pagamento, forma_pagamento
    ) VALUES (
      v_titulo_id, 1, 'parcela', v_valor_pago_total,
      coalesce(NEW.sale_date::date, current_date), 'pago',
      v_valor_pago_total, coalesce(NEW.sale_date::date, current_date), coalesce(NEW.payment_method,'mcfpay')
    );

    v_venc_base := coalesce(NEW.sale_date::date, current_date);
    IF v_parcelas_extras > 0 THEN
      v_valor_parcela := round((v_valor_pendente / v_parcelas_extras)::numeric, 2);
      v_soma := v_valor_parcela * (v_parcelas_extras - 1);
      v_valor_ultima := round((v_valor_pendente - v_soma)::numeric, 2);

      FOR i IN 1..v_parcelas_extras LOOP
        v_venc := (v_venc_base + (i || ' month')::interval)::date;
        INSERT INTO public.ar_parcelas (
          titulo_id, numero, tipo_parcela, valor, data_vencimento, status
        ) VALUES (
          v_titulo_id, 1 + i, 'parcela',
          CASE WHEN i = v_parcelas_extras THEN v_valor_ultima ELSE v_valor_parcela END,
          v_venc, 'pendente'
        );
      END LOOP;
    END IF;

    INSERT INTO public.ar_historico (titulo_id, tipo, descricao, valor)
    VALUES (v_titulo_id, 'criacao_automatica',
            'Título criado via MCF PAY (parcelado; valor total = preço de referência)', v_ref);

    RETURN NEW;
  END IF;

  -- ====================== HUBLA ======================
  -- Phantom original: net_value=0 e offer_name IS NULL, com irmão real na mesma janela
  v_is_phantom := (coalesce(NEW.net_value,0) = 0 AND NEW.offer_name IS NULL);
  IF v_is_phantom THEN
    IF EXISTS (
      SELECT 1 FROM public.hubla_transactions h2
      WHERE h2.id <> NEW.id
        AND h2.product_name ILIKE (v_code || '%')
        AND coalesce(h2.net_value,0) > 0
        AND coalesce(h2.customer_email, h2.customer_name) = coalesce(NEW.customer_email, NEW.customer_name)
        AND abs(extract(epoch from (h2.sale_date - NEW.sale_date))) < 3600
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Phantom por offer_id: linha sem offer_name quando existe irmã com mesmo offer_id e offer_name preenchido
  IF NEW.offer_name IS NULL AND NEW.offer_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.hubla_transactions h2
      WHERE h2.id <> NEW.id
        AND h2.offer_id = NEW.offer_id
        AND h2.offer_name IS NOT NULL
        AND coalesce(h2.customer_email, h2.customer_name) = coalesce(NEW.customer_email, NEW.customer_name)
        AND abs(extract(epoch from (coalesce(h2.sale_date, h2.created_at) - coalesce(NEW.sale_date, NEW.created_at)))) < 86400
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF v_code = 'A009' AND round(coalesce(NEW.product_price,0)::numeric, 2) = 17000.00 THEN
    v_tipo := 'integral';
    v_status := 'quitado';
  ELSE
    v_tipo := CASE WHEN coalesce(NEW.total_installments,1) <= 1 THEN 'integral' ELSE 'parcelado' END;
    v_status := 'aberto';
  END IF;

  INSERT INTO public.ar_titulos (
    hubla_transaction_id, customer_name, customer_email, customer_phone, customer_document,
    product_name, product_code, valor_total, payment_method,
    total_installments_hubla, tipo, status, sale_date
  ) VALUES (
    NEW.id, coalesce(NEW.customer_name,'(sem nome)'), NEW.customer_email, NEW.customer_phone, NEW.customer_document,
    NEW.product_name, v_code, coalesce(NEW.product_price,0), NEW.payment_method,
    coalesce(NEW.total_installments,1), v_tipo, v_status, NEW.sale_date
  ) RETURNING id INTO v_titulo_id;

  IF v_code = 'A009' AND round(coalesce(NEW.product_price,0)::numeric, 2) = 17000.00 THEN
    INSERT INTO public.ar_parcelas (
      titulo_id, numero, tipo_parcela, valor, data_vencimento, status,
      valor_pago, data_pagamento, forma_pagamento
    ) VALUES (
      v_titulo_id, 1, 'parcela', 17000.00,
      coalesce(NEW.sale_date::date, current_date), 'pago',
      17000.00, coalesce(NEW.sale_date::date, current_date), NEW.payment_method
    );
  ELSIF v_tipo = 'parcelado' THEN
    v_n := greatest(coalesce(NEW.total_installments,1), 1);
    v_valor_parcela := round((coalesce(NEW.product_price,0) / v_n)::numeric, 2);
    v_soma := v_valor_parcela * (v_n - 1);
    v_valor_ultima := round((coalesce(NEW.product_price,0) - v_soma - v_valor_parcela)::numeric, 2);

    INSERT INTO public.ar_parcelas (
      titulo_id, numero, tipo_parcela, valor, data_vencimento, status,
      valor_pago, data_pagamento, forma_pagamento
    ) VALUES (
      v_titulo_id, 1, 'parcela', v_valor_parcela,
      coalesce(NEW.sale_date::date, current_date), 'pago',
      v_valor_parcela, coalesce(NEW.sale_date::date, current_date), NEW.payment_method
    );

    FOR i IN 2..v_n LOOP
      v_venc := (coalesce(NEW.sale_date::date, current_date) + ((i-1) || ' month')::interval)::date;
      INSERT INTO public.ar_parcelas (
        titulo_id, numero, tipo_parcela, valor, data_vencimento, status
      ) VALUES (
        v_titulo_id, i, 'parcela',
        CASE WHEN i = v_n THEN v_valor_parcela + v_valor_ultima ELSE v_valor_parcela END,
        v_venc, 'pendente'
      );
    END LOOP;
  ELSE
    INSERT INTO public.ar_parcelas (
      titulo_id, numero, tipo_parcela, valor, data_vencimento, status
    ) VALUES (
      v_titulo_id, 1, 'parcela', coalesce(NEW.product_price,0),
      coalesce(NEW.sale_date::date, current_date), 'pendente'
    );
  END IF;

  INSERT INTO public.ar_historico (titulo_id, tipo, descricao, valor)
  VALUES (
    v_titulo_id,
    'criacao_automatica',
    'Título criado automaticamente via webhook Hubla ('||v_tipo||CASE WHEN v_status='quitado' THEN ' + baixado' ELSE '' END||')',
    coalesce(NEW.product_price,0)
  );

  RETURN NEW;
END; $function$;

-- Limpa a duplicidade específica do Esmerindo (mantém o título com offer_name "Entrada MCF")
DELETE FROM public.ar_historico WHERE titulo_id = '465b70f0-ea11-4d35-9bae-66643b182bf6';
DELETE FROM public.ar_parcelas  WHERE titulo_id = '465b70f0-ea11-4d35-9bae-66643b182bf6';
DELETE FROM public.ar_titulos   WHERE id        = '465b70f0-ea11-4d35-9bae-66643b182bf6';
