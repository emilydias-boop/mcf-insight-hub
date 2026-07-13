
-- 1) Limpeza das duplicidades B (fantasmas A009 sem pagamentos)
WITH phantom_txns AS (
  SELECT h.id
  FROM public.hubla_transactions h
  WHERE h.product_name ILIKE 'A009%'
    AND coalesce(h.net_value,0) = 0
    AND h.offer_name IS NULL
    AND coalesce(h.sale_status,'') IN ('completed','paid','approved')
    AND EXISTS (
      SELECT 1 FROM public.hubla_transactions h2
      WHERE h2.product_name ILIKE 'A009%'
        AND coalesce(h2.net_value,0) > 0
        AND coalesce(h2.customer_email, h2.customer_name) = coalesce(h.customer_email, h.customer_name)
        AND abs(extract(epoch from (h2.sale_date - h.sale_date))) < 3600
    )
),
phantom_titulos AS (
  SELECT t.id
  FROM public.ar_titulos t
  WHERE t.hubla_transaction_id IN (SELECT id FROM phantom_txns)
    AND NOT EXISTS (
      SELECT 1 FROM public.ar_parcelas p
      WHERE p.titulo_id = t.id
        AND (p.status = 'pago' OR p.valor_pago IS NOT NULL)
    )
),
del_hist AS (
  DELETE FROM public.ar_historico WHERE titulo_id IN (SELECT id FROM phantom_titulos)
),
del_parc AS (
  DELETE FROM public.ar_parcelas WHERE titulo_id IN (SELECT id FROM phantom_titulos)
)
DELETE FROM public.ar_titulos WHERE id IN (SELECT id FROM phantom_titulos);

-- 2) Nova versão da função
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

  -- Ignora transação fantasma (net_value=0 + sem offer_name) quando existe a transação real do mesmo cliente
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

  IF EXISTS (SELECT 1 FROM public.ar_titulos WHERE hubla_transaction_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Regra especial A009 valor cheio (R$17.000) → Integral + Quitado
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
    -- Integral + já baixada
    INSERT INTO public.ar_parcelas (
      titulo_id, numero, tipo_parcela, valor, data_vencimento, status,
      valor_pago, data_pagamento, forma_pagamento
    ) VALUES (
      v_titulo_id, 1, 'parcela', 17000.00,
      coalesce(NEW.sale_date::date, current_date), 'pago',
      17000.00, coalesce(NEW.sale_date::date, current_date), NEW.payment_method
    );
  ELSIF v_tipo = 'parcelado' THEN
    -- Parcela 1 paga; demais pendentes de igual valor até integralizar o total
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
    -- Integral tradicional (não A009-17k): parcela única pendente
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
