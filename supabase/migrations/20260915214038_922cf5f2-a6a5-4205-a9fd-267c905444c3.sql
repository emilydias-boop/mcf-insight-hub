CREATE OR REPLACE FUNCTION public.validate_slot_closer_meeting_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_closer_mt text;
  v_closer_name text;
  v_closer_bu text;
BEGIN
  IF NEW.closer_id IS NULL OR NEW.meeting_type IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.meeting_type, c.name, c.bu
    INTO v_closer_mt, v_closer_name, v_closer_bu
  FROM public.closers c
  WHERE c.id = NEW.closer_id;

  IF v_closer_mt IS NULL THEN
    RETURN NEW;
  END IF;

  IF lower(v_closer_mt) <> lower(NEW.meeting_type) THEN
    RAISE EXCEPTION '% nao possui cadastro de closer % na BU %. Cadastre em Configuracoes > Closers antes de transferir.',
      COALESCE(v_closer_name, 'Closer'), upper(NEW.meeting_type), COALESCE(v_closer_bu, '-');
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_slot_closer_meeting_type ON public.meeting_slots;

CREATE TRIGGER trg_validate_slot_closer_meeting_type
BEFORE INSERT OR UPDATE OF closer_id, meeting_type ON public.meeting_slots
FOR EACH ROW EXECUTE FUNCTION public.validate_slot_closer_meeting_type();

CREATE OR REPLACE FUNCTION public.reset_attendee_status_on_same_day_move()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_date date;
  new_date date;
  old_scheduled timestamptz;
  new_scheduled timestamptz;
BEGIN
  -- Só age quando o slot mudou
  IF NEW.meeting_slot_id IS NOT DISTINCT FROM OLD.meeting_slot_id THEN
    RETURN NEW;
  END IF;

  -- Preserva status finais
  IF COALESCE(NEW.status, OLD.status) IN ('contract_paid','completed','refunded','approved','rejected') THEN
    RETURN NEW;
  END IF;

  -- Buscar datas de origem e destino
  SELECT scheduled_at INTO old_scheduled FROM public.meeting_slots WHERE id = OLD.meeting_slot_id;
  SELECT scheduled_at INTO new_scheduled FROM public.meeting_slots WHERE id = NEW.meeting_slot_id;

  IF old_scheduled IS NULL OR new_scheduled IS NULL THEN
    RETURN NEW;
  END IF;

  old_date := (old_scheduled AT TIME ZONE 'America/Sao_Paulo')::date;
  new_date := (new_scheduled AT TIME ZONE 'America/Sao_Paulo')::date;

  -- Mesmo dia: anula o no-show de quem foi remanejado e marca o encadeamento,
  -- SEM esconder o registro da agenda (o registro aponta para o slot NOVO).
  IF old_date = new_date THEN
    IF COALESCE(NEW.status, OLD.status) = 'no_show' THEN
      NEW.status := 'invited';
    END IF;
    NEW.is_reschedule := true;
  END IF;

  RETURN NEW;
END;
$function$;