
-- 1. Colunas de autoria visível no próprio registro
ALTER TABLE public.consorcio_pending_registrations
  ADD COLUMN IF NOT EXISTS deal_vinculo_ajustado_por uuid,
  ADD COLUMN IF NOT EXISTS deal_vinculo_ajustado_em timestamptz,
  ADD COLUMN IF NOT EXISTS deal_vinculo_anterior uuid;

ALTER TABLE public.meeting_slot_attendees
  ADD COLUMN IF NOT EXISTS booked_by_ajustado_por uuid,
  ADD COLUMN IF NOT EXISTS booked_by_ajustado_em timestamptz,
  ADD COLUMN IF NOT EXISTS booked_by_anterior uuid;

-- 2. Trilha do vínculo cota -> lead (consorcio_pending_registrations.deal_id)
CREATE OR REPLACE FUNCTION public.tg_audit_pending_deal_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.deal_id IS DISTINCT FROM OLD.deal_id THEN
    NEW.deal_vinculo_anterior := OLD.deal_id;
    NEW.deal_vinculo_ajustado_por := v_actor;
    NEW.deal_vinculo_ajustado_em := now();

    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      v_actor,
      'pending_deal_link_changed',
      'consorcio_pending_registrations',
      NEW.id,
      jsonb_build_object('deal_id', OLD.deal_id, 'consortium_card_id', OLD.consortium_card_id),
      jsonb_build_object('deal_id', NEW.deal_id, 'consortium_card_id', NEW.consortium_card_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_pending_deal_link ON public.consorcio_pending_registrations;
CREATE TRIGGER trg_audit_pending_deal_link
  BEFORE UPDATE ON public.consorcio_pending_registrations
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_pending_deal_link();

-- 2b. Criação de cadastro já vinculado a uma cota existente também deixa rastro
CREATE OR REPLACE FUNCTION public.tg_audit_pending_deal_link_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deal_id IS NOT NULL AND NEW.consortium_card_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'pending_deal_link_created',
      'consorcio_pending_registrations',
      NEW.id,
      NULL,
      jsonb_build_object('deal_id', NEW.deal_id, 'consortium_card_id', NEW.consortium_card_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_pending_deal_link_insert ON public.consorcio_pending_registrations;
CREATE TRIGGER trg_audit_pending_deal_link_insert
  AFTER INSERT ON public.consorcio_pending_registrations
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_pending_deal_link_insert();

-- 3. Trilha do agendador (meeting_slot_attendees.booked_by)
CREATE OR REPLACE FUNCTION public.tg_audit_attendee_booked_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.booked_by IS DISTINCT FROM OLD.booked_by THEN
    NEW.booked_by_anterior := OLD.booked_by;
    NEW.booked_by_ajustado_por := v_actor;
    NEW.booked_by_ajustado_em := now();

    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      v_actor,
      'attendee_booked_by_changed',
      'meeting_slot_attendees',
      NEW.id,
      jsonb_build_object('booked_by', OLD.booked_by, 'deal_id', OLD.deal_id),
      jsonb_build_object('booked_by', NEW.booked_by, 'deal_id', NEW.deal_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_attendee_booked_by ON public.meeting_slot_attendees;
CREATE TRIGGER trg_audit_attendee_booked_by
  BEFORE UPDATE ON public.meeting_slot_attendees
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_attendee_booked_by();
