-- 1) Trigger passa a poder pular o log por parcela quando a geração é em lote
CREATE OR REPLACE FUNCTION public._tg_log_consortium_installment_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.card_id IS NULL THEN RETURN NEW; END IF;
    -- Geração em lote (cronograma): o log é feito uma única vez pela RPC
    IF coalesce(current_setting('app.bulk_parcelas', true), '') = 'on' THEN
      RETURN NEW;
    END IF;
    PERFORM public.log_card_event(
      NEW.card_id, 'parcela'::public.card_activity_category, 'installment_created'::public.card_activity_event,
      'Parcela ' || NEW.numero_parcela || ' criada (R$ ' || to_char(NEW.valor_parcela,'FM999G999G990D00') || ')',
      NULL, to_jsonb(NEW), '{}'::jsonb, NULL, NEW.id, NULL, NULL
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.card_id IS NULL THEN RETURN OLD; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.consortium_cards WHERE id = OLD.card_id) THEN
      RETURN OLD;
    END IF;
    PERFORM public.log_card_event(
      OLD.card_id, 'parcela', 'installment_deleted',
      'Parcela ' || OLD.numero_parcela || ' excluída',
      to_jsonb(OLD), NULL, '{}'::jsonb, NULL, OLD.id, NULL, NULL
    );
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.card_id IS NULL THEN RETURN NEW; END IF;

    IF (COALESCE(OLD.status,'') <> 'pago' AND NEW.status = 'pago') THEN
      PERFORM public.log_card_event(
        NEW.card_id, 'parcela', 'installment_paid',
        'Parcela ' || NEW.numero_parcela || ' marcada como paga (R$ ' || to_char(NEW.valor_parcela,'FM999G999G990D00') || ')',
        to_jsonb(OLD), to_jsonb(NEW), '{}'::jsonb, NULL, NEW.id, NULL, NULL
      );
    ELSIF (COALESCE(OLD.status,'') = 'pago' AND NEW.status <> 'pago') THEN
      PERFORM public.log_card_event(
        NEW.card_id, 'parcela', 'installment_reverted',
        'Pagamento da parcela ' || NEW.numero_parcela || ' revertido',
        to_jsonb(OLD), to_jsonb(NEW), '{}'::jsonb, NULL, NEW.id, NULL, NULL
      );
    END IF;

    IF (COALESCE(OLD.valor_parcela,0) <> COALESCE(NEW.valor_parcela,0)) THEN
      PERFORM public.log_card_event(
        NEW.card_id, 'parcela', 'installment_value_changed',
        'Valor da parcela ' || NEW.numero_parcela || ' alterado de R$ ' ||
          to_char(OLD.valor_parcela,'FM999G999G990D00') || ' para R$ ' || to_char(NEW.valor_parcela,'FM999G999G990D00'),
        jsonb_build_object('valor_parcela', OLD.valor_parcela),
        jsonb_build_object('valor_parcela', NEW.valor_parcela),
        '{}'::jsonb, NULL, NEW.id, NULL, NULL
      );
    END IF;

    IF (OLD.data_vencimento IS DISTINCT FROM NEW.data_vencimento) THEN
      PERFORM public.log_card_event(
        NEW.card_id, 'parcela', 'installment_due_changed',
        'Vencimento da parcela ' || NEW.numero_parcela || ' alterado de ' ||
          to_char(OLD.data_vencimento,'DD/MM/YYYY') || ' para ' || to_char(NEW.data_vencimento,'DD/MM/YYYY'),
        jsonb_build_object('data_vencimento', OLD.data_vencimento),
        jsonb_build_object('data_vencimento', NEW.data_vencimento),
        '{}'::jsonb, NULL, NEW.id, NULL, NULL
      );
    END IF;

    IF (OLD.data_pagamento IS DISTINCT FROM NEW.data_pagamento) THEN
      PERFORM public.log_card_event(
        NEW.card_id, 'parcela', 'installment_form_changed',
        'Data de pagamento da parcela ' || NEW.numero_parcela || ' alterada para ' || COALESCE(to_char(NEW.data_pagamento,'DD/MM/YYYY'),'-'),
        jsonb_build_object('data_pagamento', OLD.data_pagamento),
        jsonb_build_object('data_pagamento', NEW.data_pagamento),
        '{}'::jsonb, NULL, NEW.id, NULL, NULL
      );
    END IF;

    RETURN NEW;
  END IF;
  RETURN NULL;
END $function$;

-- 2) RPC de geração em lote: uma transação, um único lançamento no histórico
CREATE OR REPLACE FUNCTION public.consorcio_gerar_parcelas(p_card_id uuid, p_parcelas jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_qtd integer := 0;
BEGIN
  IF p_card_id IS NULL OR p_parcelas IS NULL OR jsonb_typeof(p_parcelas) <> 'array' THEN
    RAISE EXCEPTION 'card_id e array de parcelas são obrigatórios';
  END IF;

  PERFORM set_config('app.bulk_parcelas', 'on', true);

  INSERT INTO public.consortium_installments
    (card_id, numero_parcela, tipo, valor_parcela, valor_comissao, data_vencimento, status)
  SELECT
    p_card_id,
    (e->>'numero_parcela')::int,
    (e->>'tipo'),
    (e->>'valor_parcela')::numeric,
    (e->>'valor_comissao')::numeric,
    (e->>'data_vencimento')::date,
    (e->>'status')
  FROM jsonb_array_elements(p_parcelas) e;

  SELECT count(*) INTO v_qtd FROM jsonb_array_elements(p_parcelas);

  PERFORM public.log_card_event(
    p_card_id, 'parcela'::public.card_activity_category, 'installment_created'::public.card_activity_event,
    'Cronograma de ' || v_qtd || ' parcelas gerado',
    NULL, jsonb_build_object('quantidade', v_qtd), '{}'::jsonb, NULL, NULL, NULL, NULL
  );

  PERFORM set_config('app.bulk_parcelas', 'off', true);
  RETURN v_qtd;
END $$;

GRANT EXECUTE ON FUNCTION public.consorcio_gerar_parcelas(uuid, jsonb) TO authenticated, service_role;