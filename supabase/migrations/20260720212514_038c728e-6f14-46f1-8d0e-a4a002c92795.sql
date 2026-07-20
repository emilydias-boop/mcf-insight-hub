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
  i int;
BEGIN
  IF coalesce(NEW.sale_status,'') NOT IN ('completed','paid') THEN
    RETURN NEW;
  END IF;

  v_code := public.ar_extract_product_code(NEW.product_name);
  IF v_code IS NULL OR NOT v_code = ANY(ARRAY['A001','A002','A003','A004','A005','A006','A007','A008','A009','A000']) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.ar_titulos WHERE hubla_transaction_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.payment_method,'') = 'mcfpay' THEN
    v_ref := public.get_produto_preco(v_code);
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

  -- Rest of original logic
  IF v_code IN ('A001','A002','A003','A004','A009') THEN
    v_valor_total_hubla := coalesce(NEW.product_price, 0);
    IF v_valor_total_hubla <= 0 THEN
      v_valor_total_hubla := public.get_produto_preco(v_code);
    END IF;
    v_tipo := CASE WHEN coalesce(NEW.installments,1) > 1 THEN 'parcelado' ELSE 'a_vista' END;
    v_status := CASE WHEN v_code = 'A009' THEN 'quitado' ELSE 'aberto' END;
  ELSE
    v_valor_total_hubla := coalesce(NEW.product_price, public.get_produto_preco(v_code));
    v_tipo := CASE WHEN coalesce(NEW.installments,1) > 1 THEN 'parcelado' ELSE 'a_vista' END;
    v_status := 'aberto';
  END IF;

  INSERT INTO public.ar_titulos (
    hubla_transaction_id, customer_name, customer_email, customer_phone, customer_document,
    product_name, product_code, valor_total, payment_method,
    total_installments_hubla, tipo, status, sale_date
  ) VALUES (
    NEW.id, coalesce(NEW.customer_name,'(sem nome)'), NEW.customer_email, NEW.customer_phone, NEW.customer_document,
    NEW.product_name, v_code, v_valor_total_hubla, coalesce(NEW.payment_method,'hubla'),
    coalesce(NEW.installments,1), v_tipo, v_status, NEW.sale_date
  ) RETURNING id INTO v_titulo_id;

  INSERT INTO public.ar_parcelas (
    titulo_id, numero, tipo_parcela, valor, data_vencimento, status,
    valor_pago, data_pagamento, forma_pagamento
  ) VALUES (
    v_titulo_id, 1, 'entrada', coalesce(NEW.product_price, v_valor_total_hubla),
    coalesce(NEW.sale_date::date, current_date),
    CASE WHEN v_status = 'quitado' THEN 'pago' ELSE 'pago' END,
    coalesce(NEW.product_price, v_valor_total_hubla),
    coalesce(NEW.sale_date::date, current_date),
    coalesce(NEW.payment_method,'hubla')
  );

  IF coalesce(NEW.installments,1) > 1 AND v_status <> 'quitado' THEN
    v_valor_pendente := greatest(v_valor_total_hubla - coalesce(NEW.product_price,0), 0);
    v_parcelas_extras := coalesce(NEW.installments,1) - 1;
    IF v_parcelas_extras > 0 AND v_valor_pendente > 0 THEN
      v_valor_parcela := round((v_valor_pendente / v_parcelas_extras)::numeric, 2);
      v_soma := v_valor_parcela * (v_parcelas_extras - 1);
      v_valor_ultima := round((v_valor_pendente - v_soma)::numeric, 2);
      v_venc_base := coalesce(NEW.sale_date::date, current_date);
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
  END IF;

  INSERT INTO public.ar_historico (titulo_id, tipo, descricao, valor)
  VALUES (v_titulo_id, 'criacao_automatica', 'Título criado via Hubla', v_valor_total_hubla);

  RETURN NEW;
END;
$function$;