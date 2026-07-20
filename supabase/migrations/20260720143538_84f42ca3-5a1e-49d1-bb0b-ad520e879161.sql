
-- Dedupe Hubla A001-A009: quando o mesmo cliente+offer_id gera duas transações
-- (1x com juros e Nx recorrência), manter apenas o título da recorrência (valor original).

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
  v_valor_total_hubla numeric;
  v_sibling_recorrencia record;
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

  -- NOVO: dedupe recorrência x parcela única com juros.
  -- Quando o Hubla envia dois eventos para o mesmo offer_id (um total_installments=1 com valor total já com juros
  -- e outro total_installments>1 com o valor original), mantemos apenas o registro que representa o valor original.
  -- Estratégia: se este evento é a versão "1x com juros" e existe um irmão Nx recorrência com o mesmo
  -- customer_email + offer_id, ignoramos. Se este evento é a versão Nx e já existe título para o irmão 1x,
  -- removemos o título do irmão (desde que não tenha baixas manuais) para dar lugar ao correto.
  IF v_code IN ('A001','A002','A003','A004','A009') AND NEW.offer_id IS NOT NULL THEN
    -- caso 1: este é o registro 1x com juros; existe irmão Nx com valor original -> ignora
    IF coalesce(NEW.total_installments,1) = 1 THEN
      IF EXISTS (
        SELECT 1 FROM public.hubla_transactions h2
        WHERE h2.id <> NEW.id
          AND h2.offer_id = NEW.offer_id
          AND lower(coalesce(h2.customer_email,'')) = lower(coalesce(NEW.customer_email,''))
          AND coalesce(h2.total_installments,1) > 1
          AND abs(extract(epoch from (coalesce(h2.sale_date, h2.created_at) - coalesce(NEW.sale_date, NEW.created_at)))) < 86400
      ) THEN
        RETURN NEW;
      END IF;
    ELSE
      -- caso 2: este é o registro Nx (valor original); se o irmão 1x já criou um título sem baixas, removê-lo
      SELECT t.id AS titulo_id, h2.id AS hubla_id
        INTO v_sibling_recorrencia
      FROM public.hubla_transactions h2
      JOIN public.ar_titulos t ON t.hubla_transaction_id = h2.id
      WHERE h2.id <> NEW.id
        AND h2.offer_id = NEW.offer_id
        AND lower(coalesce(h2.customer_email,'')) = lower(coalesce(NEW.customer_email,''))
        AND coalesce(h2.total_installments,1) = 1
        AND abs(extract(epoch from (coalesce(h2.sale_date, h2.created_at) - coalesce(NEW.sale_date, NEW.created_at)))) < 86400
      LIMIT 1;

      IF v_sibling_recorrencia.titulo_id IS NOT NULL THEN
        -- só remove se não houver parcelas pagas manualmente / histórico manual
        IF NOT EXISTS (
          SELECT 1 FROM public.ar_parcelas p
          WHERE p.titulo_id = v_sibling_recorrencia.titulo_id
            AND p.status = 'pago'
            AND p.data_pagamento IS NOT NULL
            AND p.numero > 0
        ) THEN
          DELETE FROM public.ar_historico WHERE titulo_id = v_sibling_recorrencia.titulo_id;
          DELETE FROM public.ar_parcelas WHERE titulo_id = v_sibling_recorrencia.titulo_id;
          DELETE FROM public.ar_titulos WHERE id = v_sibling_recorrencia.titulo_id;
        END IF;
      END IF;
    END IF;
  END IF;

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

  IF coalesce(NEW.total_installments,1) > 1 THEN
    v_valor_total_hubla := round((coalesce(NEW.product_price,0) * NEW.total_installments)::numeric, 2);
  ELSE
    v_valor_total_hubla := coalesce(NEW.product_price,0);
  END IF;

  INSERT INTO public.ar_titulos (
    hubla_transaction_id, customer_name, customer_email, customer_phone, customer_document,
    product_name, product_code, valor_total, payment_method,
    total_installments_hubla, tipo, status, sale_date
  ) VALUES (
    NEW.id, coalesce(NEW.customer_name,'(sem nome)'), NEW.customer_email, NEW.customer_phone, NEW.customer_document,
    NEW.product_name, v_code, v_valor_total_hubla, NEW.payment_method,
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
  END IF;

  INSERT INTO public.ar_historico (titulo_id, tipo, descricao, valor)
  VALUES (v_titulo_id, 'criacao_automatica',
          'Título criado automaticamente via Hubla', v_valor_total_hubla);

  RETURN NEW;
END;
$function$;

-- Backfill: remove títulos duplicados "1x com juros" quando existe o irmão Nx (valor original) sem baixas manuais.
WITH duplicados AS (
  SELECT t1.id AS titulo_remover
  FROM public.ar_titulos t1
  JOIN public.hubla_transactions h1 ON h1.id = t1.hubla_transaction_id
  JOIN public.hubla_transactions h2
    ON h2.id <> h1.id
   AND h2.offer_id = h1.offer_id
   AND lower(coalesce(h2.customer_email,'')) = lower(coalesce(h1.customer_email,''))
   AND coalesce(h2.total_installments,1) > 1
   AND abs(extract(epoch from (coalesce(h2.sale_date, h2.created_at) - coalesce(h1.sale_date, h1.created_at)))) < 86400
  JOIN public.ar_titulos t2 ON t2.hubla_transaction_id = h2.id
  WHERE t1.product_code IN ('A001','A002','A003','A004','A009')
    AND coalesce(h1.total_installments,1) = 1
    AND h1.offer_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.ar_parcelas p
      WHERE p.titulo_id = t1.id
        AND p.status = 'pago'
        AND p.data_pagamento IS NOT NULL
        AND p.numero > 0
    )
)
DELETE FROM public.ar_titulos WHERE id IN (SELECT titulo_remover FROM duplicados);
