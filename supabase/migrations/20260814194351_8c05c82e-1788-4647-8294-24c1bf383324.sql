-- 1) Permitir códigos que começam com A ou R
CREATE OR REPLACE FUNCTION public.ar_extract_product_code(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT UPPER(substring(coalesce(p_name,'') FROM '^([AaRr][0-9]{3})'));
$function$;

-- 2) Trigger: aceitar R001/R009 (recorrência)
CREATE OR REPLACE FUNCTION public.ar_create_from_hubla()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_tipo text;
  v_status text;
  v_titulo_id uuid;
  v_is_phantom boolean;
  v_ref numeric;
  v_valor_pago_total numeric;
  v_valor_pendente numeric;
  v_parcelas_extras int;
  v_valor_parcela numeric;
  v_soma numeric;
  v_valor_ultima numeric;
  v_venc_base date;
  v_venc date;
  v_valor_total_hubla numeric;
  v_chave text;
  v_is_recorrencia boolean;
  v_parcelas int;
  i int;
BEGIN
  IF coalesce(NEW.sale_status,'') NOT IN ('completed','paid') THEN
    RETURN NEW;
  END IF;

  v_code := public.ar_extract_product_code(NEW.product_name);
  IF v_code IS NULL OR NOT v_code = ANY(ARRAY['A001','A002','A003','A004','A005','A006','A007','A008','A009','R001','R009']) THEN
    RETURN NEW;
  END IF;

  v_is_recorrencia := v_code IN ('R001','R009');

  IF EXISTS (SELECT 1 FROM public.ar_titulos WHERE hubla_transaction_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- bloqueia duplicidade por mesmo cliente+produto em janela de 1h
  v_chave := coalesce(lower(NEW.customer_email), NEW.customer_phone, NEW.customer_name);
  IF v_chave IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ar_titulos t
    WHERE t.product_code = v_code
      AND coalesce(lower(t.customer_email), t.customer_phone, t.customer_name) = v_chave
      AND abs(extract(epoch from (coalesce(t.sale_date, t.created_at) - coalesce(NEW.sale_date, NEW.created_at)))) < 3600
  ) THEN
    RETURN NEW;
  END IF;

  -- Recorrência (R001/R009): valor total = mensalidade x nº de cobranças
  IF v_is_recorrencia THEN
    v_valor_parcela := coalesce(NEW.product_price, NEW.net_value, 0);
    IF v_valor_parcela <= 0 THEN
      RETURN NEW;
    END IF;
    v_parcelas := greatest(coalesce(NEW.total_installments, 1), 1);
    v_valor_total_hubla := round((v_valor_parcela * v_parcelas)::numeric, 2);

    INSERT INTO public.ar_titulos (
      hubla_transaction_id, customer_name, customer_email, customer_phone, customer_document,
      product_name, product_code, valor_total, payment_method,
      total_installments_hubla, tipo, status, sale_date
    ) VALUES (
      NEW.id, coalesce(NEW.customer_name,'(sem nome)'), NEW.customer_email, NEW.customer_phone, NEW.customer_document,
      NEW.product_name, v_code, v_valor_total_hubla, NEW.payment_method,
      v_parcelas, CASE WHEN v_parcelas > 1 THEN 'parcelado' ELSE 'integral' END, 'aberto', NEW.sale_date
    ) RETURNING id INTO v_titulo_id;

    v_venc_base := coalesce(NEW.sale_date::date, current_date);
    FOR i IN 1..v_parcelas LOOP
      v_venc := (v_venc_base + ((i-1) || ' month')::interval)::date;
      INSERT INTO public.ar_parcelas (
        titulo_id, numero, tipo_parcela, valor, data_vencimento, status,
        valor_pago, data_pagamento, forma_pagamento
      ) VALUES (
        v_titulo_id, i, 'parcela', v_valor_parcela, v_venc,
        CASE WHEN i = 1 THEN 'pago' ELSE 'pendente' END,
        CASE WHEN i = 1 THEN v_valor_parcela ELSE NULL END,
        CASE WHEN i = 1 THEN v_venc_base ELSE NULL END,
        CASE WHEN i = 1 THEN NEW.payment_method ELSE NULL END
      );
    END LOOP;

    INSERT INTO public.ar_historico (titulo_id, tipo, descricao, valor)
    VALUES (v_titulo_id, 'criacao_automatica',
            'Título criado automaticamente via Hubla (venda em recorrência ' || v_code || ')', v_valor_total_hubla);
    RETURN NEW;
  END IF;

  IF coalesce(NEW.payment_method,'') = 'mcfpay' THEN
    v_ref := public.ar_get_reference_price(v_code);
    IF v_ref IS NULL OR v_ref <= 0 THEN
      RETURN NEW;
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

  IF v_code IN ('A001','A002','A003','A004','A009') THEN
    v_valor_total_hubla := coalesce(NEW.product_price, 0);
  ELSE
    v_valor_total_hubla := coalesce(NEW.net_value, NEW.product_price, 0);
  END IF;

  IF coalesce(NEW.total_installments,1) > 1 THEN
    v_tipo := 'parcelado';
  ELSE
    v_tipo := 'integral';
  END IF;
  v_status := 'aberto';

  INSERT INTO public.ar_titulos (
    hubla_transaction_id, customer_name, customer_email, customer_phone, customer_document,
    product_name, product_code, valor_total, payment_method,
    total_installments_hubla, tipo, status, sale_date
  ) VALUES (
    NEW.id, coalesce(NEW.customer_name,'(sem nome)'), NEW.customer_email, NEW.customer_phone, NEW.customer_document,
    NEW.product_name, v_code, v_valor_total_hubla, NEW.payment_method,
    coalesce(NEW.total_installments,1), v_tipo, v_status, NEW.sale_date
  ) RETURNING id INTO v_titulo_id;

  IF v_tipo = 'integral' THEN
    INSERT INTO public.ar_parcelas (
      titulo_id, numero, tipo_parcela, valor, data_vencimento, status,
      valor_pago, data_pagamento, forma_pagamento
    ) VALUES (
      v_titulo_id, 1, 'parcela', v_valor_total_hubla,
      coalesce(NEW.sale_date::date, current_date), 'pago',
      v_valor_total_hubla, coalesce(NEW.sale_date::date, current_date), NEW.payment_method
    );
  ELSE
    v_valor_parcela := round((v_valor_total_hubla / coalesce(NEW.total_installments,1))::numeric, 2);
    v_venc_base := coalesce(NEW.sale_date::date, current_date);
    FOR i IN 1..coalesce(NEW.total_installments,1) LOOP
      v_venc := (v_venc_base + ((i-1) || ' month')::interval)::date;
      INSERT INTO public.ar_parcelas (
        titulo_id, numero, tipo_parcela, valor, data_vencimento, status,
        valor_pago, data_pagamento, forma_pagamento
      ) VALUES (
        v_titulo_id, i, 'parcela', v_valor_parcela, v_venc,
        CASE WHEN i = 1 THEN 'pago' ELSE 'pendente' END,
        CASE WHEN i = 1 THEN v_valor_parcela ELSE NULL END,
        CASE WHEN i = 1 THEN coalesce(NEW.sale_date::date, current_date) ELSE NULL END,
        CASE WHEN i = 1 THEN NEW.payment_method ELSE NULL END
      );
    END LOOP;
  END IF;

  INSERT INTO public.ar_historico (titulo_id, tipo, descricao, valor)
  VALUES (v_titulo_id, 'criacao_automatica', 'Título criado automaticamente via Hubla', v_valor_total_hubla);

  RETURN NEW;
END;
$function$;

-- 3) Backfill das vendas R001/R009 já recebidas
DO $$
DECLARE
  r record;
  v_titulo_id uuid;
  v_parcelas int;
  v_valor_parcela numeric;
  v_venc_base date;
  i int;
BEGIN
  FOR r IN
    SELECT h.*
    FROM public.hubla_transactions h
    WHERE public.ar_extract_product_code(h.product_name) IN ('R001','R009')
      AND coalesce(h.sale_status,'') IN ('completed','paid')
      AND NOT EXISTS (SELECT 1 FROM public.ar_titulos t WHERE t.hubla_transaction_id = h.id)
    ORDER BY h.sale_date
  LOOP
    v_valor_parcela := coalesce(r.product_price, r.net_value, 0);
    CONTINUE WHEN v_valor_parcela <= 0;
    v_parcelas := greatest(coalesce(r.total_installments, 1), 1);
    v_venc_base := coalesce(r.sale_date::date, current_date);

    INSERT INTO public.ar_titulos (
      hubla_transaction_id, customer_name, customer_email, customer_phone, customer_document,
      product_name, product_code, valor_total, payment_method,
      total_installments_hubla, tipo, status, sale_date
    ) VALUES (
      r.id, coalesce(r.customer_name,'(sem nome)'), r.customer_email, r.customer_phone, r.customer_document,
      r.product_name, public.ar_extract_product_code(r.product_name),
      round((v_valor_parcela * v_parcelas)::numeric, 2), r.payment_method,
      v_parcelas, CASE WHEN v_parcelas > 1 THEN 'parcelado' ELSE 'integral' END, 'aberto', r.sale_date
    ) RETURNING id INTO v_titulo_id;

    FOR i IN 1..v_parcelas LOOP
      INSERT INTO public.ar_parcelas (
        titulo_id, numero, tipo_parcela, valor, data_vencimento, status,
        valor_pago, data_pagamento, forma_pagamento
      ) VALUES (
        v_titulo_id, i, 'parcela', v_valor_parcela,
        (v_venc_base + ((i-1) || ' month')::interval)::date,
        CASE WHEN i = 1 THEN 'pago' ELSE 'pendente' END,
        CASE WHEN i = 1 THEN v_valor_parcela ELSE NULL END,
        CASE WHEN i = 1 THEN v_venc_base ELSE NULL END,
        CASE WHEN i = 1 THEN r.payment_method ELSE NULL END
      );
    END LOOP;

    INSERT INTO public.ar_historico (titulo_id, tipo, descricao, valor)
    VALUES (v_titulo_id, 'criacao_automatica',
            'Título criado no backfill de recorrência (Hubla)', round((v_valor_parcela * v_parcelas)::numeric, 2));
  END LOOP;
END $$;