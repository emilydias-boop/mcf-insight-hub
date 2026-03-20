
CREATE OR REPLACE FUNCTION public.notify_suspicious_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_status TEXT;
  new_status TEXT;
  is_suspicious BOOLEAN := FALSE;
  attendee_name TEXT;
  closer_name TEXT;
  closer_bu TEXT;
  meeting_date TIMESTAMPTZ;
  changer_name TEXT;
  manager_record RECORD;
BEGIN
  IF NEW.table_name != 'meeting_slot_attendees' THEN
    RETURN NEW;
  END IF;

  old_status := NEW.old_data->>'status';
  new_status := NEW.new_data->>'status';

  IF old_status IS NULL OR new_status IS NULL OR old_status = new_status THEN
    RETURN NEW;
  END IF;

  IF (old_status = 'no_show' AND new_status IN ('completed', 'invited'))
     OR (old_status = 'completed' AND new_status IN ('no_show', 'invited')) THEN
    is_suspicious := TRUE;
  END IF;

  IF NOT is_suspicious THEN
    RETURN NEW;
  END IF;

  SELECT 
    COALESCE(msa.attendee_name, 'Lead desconhecido'),
    c.name,
    c.bu,
    ms.scheduled_at,
    COALESCE(p.full_name, p.email, 'Usuário desconhecido')
  INTO attendee_name, closer_name, closer_bu, meeting_date, changer_name
  FROM meeting_slot_attendees msa
  JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
  LEFT JOIN closers c ON c.id = ms.closer_id
  LEFT JOIN profiles p ON p.id = NEW.user_id
  WHERE msa.id = NEW.record_id::uuid;

  IF closer_bu IS NULL THEN
    RETURN NEW;
  END IF;

  FOR manager_record IN
    SELECT DISTINCT p.id as user_id
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE ur.role IN ('admin', 'manager', 'coordenador')
      AND p.squad IS NOT NULL
      AND closer_bu = ANY(p.squad::text[])
  LOOP
    INSERT INTO alertas (user_id, tipo, titulo, descricao, metadata)
    VALUES (
      manager_record.user_id,
      'aviso',
      'Mudança suspeita de status',
      changer_name || ' alterou status de "' || old_status || '" para "' || new_status || '" — Lead: ' || attendee_name || ', Closer: ' || COALESCE(closer_name, 'N/A'),
      jsonb_build_object(
        'type', 'status_reversal',
        'attendee_id', NEW.record_id,
        'old_status', old_status,
        'new_status', new_status,
        'changed_by', NEW.user_id,
        'changed_by_name', changer_name,
        'closer_name', closer_name,
        'closer_bu', closer_bu,
        'meeting_date', meeting_date,
        'attendee_name', attendee_name
      )
    );
  END LOOP;

  RETURN NEW;
END;
$function$;
