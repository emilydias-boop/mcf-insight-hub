CREATE OR REPLACE FUNCTION public.log_slot_time_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid;
  v_actor_name text;
  v_from_closer_name text;
  v_to_closer_name text;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NOT NULL THEN
      SELECT p.full_name INTO v_actor_name FROM public.profiles p WHERE p.id = v_actor;
      IF NOT FOUND THEN
        v_actor := NULL;
      END IF;
    END IF;

    -- Nomes buscados separadamente: se o UPDATE alterar scheduled_at e closer_id
    -- juntos, from_closer_name precisa refletir o closer ANTIGO (OLD.closer_id).
    SELECT c.name INTO v_from_closer_name FROM public.closers c WHERE c.id = OLD.closer_id;
    SELECT c.name INTO v_to_closer_name FROM public.closers c WHERE c.id = NEW.closer_id;

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
      OLD.closer_id, v_from_closer_name,
      NEW.closer_id, v_to_closer_name,
      a.status,
      'Data da reunião alterada no slot (sem criação de novo registro)',
      'slot_time_changed',
      v_actor, v_actor_name
    FROM public.meeting_slot_attendees a
    WHERE a.meeting_slot_id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NULL;
END;
$function$;