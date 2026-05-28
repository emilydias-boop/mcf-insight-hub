CREATE OR REPLACE FUNCTION public._tg_log_consortium_installment_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.card_id IS NULL THEN RETURN NEW; END IF;
    PERFORM public.log_card_event(
      NEW.card_id, 'parcela'::public.card_activity_category, 'installment_created'::public.card_activity_event,
      'Parcela ' || NEW.numero_parcela || ' criada (R$ ' || to_char(NEW.valor_parcela,'FM999G999G990D00') || ')',
      NULL, to_jsonb(NEW), '{}'::jsonb, NULL, NEW.id, NULL, NULL
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.card_id IS NULL THEN RETURN OLD; END IF;
    -- Skip logging if parent card no longer exists (cascade delete from consortium_cards)
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