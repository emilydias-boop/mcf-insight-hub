ALTER TABLE public.consortium_card_activity_log
  DROP CONSTRAINT IF EXISTS consortium_card_activity_log_card_id_fkey;

ALTER TABLE public.consortium_card_activity_log
  ALTER COLUMN card_id DROP NOT NULL;

ALTER TABLE public.consortium_card_activity_log
  ADD CONSTRAINT consortium_card_activity_log_card_id_fkey
  FOREIGN KEY (card_id)
  REFERENCES public.consortium_cards(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.log_card_event(
  _card_id uuid,
  _category public.card_activity_category,
  _event public.card_activity_event,
  _description text,
  _before jsonb DEFAULT NULL,
  _after jsonb DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _subscription_id uuid DEFAULT NULL,
  _installment_id uuid DEFAULT NULL,
  _boleto_id uuid DEFAULT NULL,
  _document_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _name text := public._actor_name(auth.uid());
  _id uuid;
BEGIN
  IF _card_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.consortium_cards WHERE id = _card_id) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.consortium_card_activity_log(
    card_id, subscription_id, installment_id, boleto_id, document_id,
    event_category, event_type, description, before_value, after_value, metadata,
    actor_id, actor_name
  ) VALUES (
    _card_id, _subscription_id, _installment_id, _boleto_id, _document_id,
    _category, _event, _description, _before, _after, COALESCE(_metadata,'{}'::jsonb),
    _uid, COALESCE(_name,'Sistema')
  ) RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_card_event(uuid,public.card_activity_category,public.card_activity_event,text,jsonb,jsonb,jsonb,uuid,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_card_event(uuid,public.card_activity_category,public.card_activity_event,text,jsonb,jsonb,jsonb,uuid,uuid,uuid,uuid) TO service_role;