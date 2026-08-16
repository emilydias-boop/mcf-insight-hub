-- B1: default for booked_at
ALTER TABLE public.meeting_slot_attendees ALTER COLUMN booked_at SET DEFAULT now();

-- B2: backfill history (auditability only; RPCs already COALESCE at runtime)
UPDATE public.meeting_slot_attendees
SET booked_at = created_at
WHERE booked_at IS NULL;

-- B3: log any retroactive change of a slot's scheduled_at, one row per attendee
CREATE OR REPLACE FUNCTION public.log_slot_time_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_actor_name text;
  v_closer_name text;
BEGIN
  BEGIN
    v_actor := auth.uid();
    -- moved_by references public.profiles(id); leave NULL when the actor has no profile
    -- (e.g. service_role / trigger-driven updates) instead of inventing a value.
    IF v_actor IS NOT NULL THEN
      SELECT p.full_name INTO v_actor_name FROM public.profiles p WHERE p.id = v_actor;
      IF NOT FOUND THEN
        v_actor := NULL;
      END IF;
    END IF;

    SELECT c.name INTO v_closer_name FROM public.closers c WHERE c.id = NEW.closer_id;

    INSERT INTO public.attendee_movement_logs (
      attendee_id, from_slot_id, to_slot_id,
      from_scheduled_at, to_scheduled_at,
      from_closer_id, from_closer_name,
      to_closer_id, to_closer_name,
      previous_status, reason, movement_type,
      moved_by, moved_by_name
    )
    SELECT
      a.id, NEW.id, NEW.id,
      OLD.scheduled_at, NEW.scheduled_at,
      OLD.closer_id, v_closer_name,
      NEW.closer_id, v_closer_name,
      a.status,
      'Data da reunião alterada no slot (sem criação de novo registro)',
      'slot_time_changed',
      v_actor, v_actor_name
    FROM public.meeting_slot_attendees a
    WHERE a.meeting_slot_id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block the slot update because of logging
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_slot_time_change ON public.meeting_slots;
CREATE TRIGGER trg_log_slot_time_change
AFTER UPDATE OF scheduled_at ON public.meeting_slots
FOR EACH ROW
WHEN (OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at)
EXECUTE FUNCTION public.log_slot_time_change();