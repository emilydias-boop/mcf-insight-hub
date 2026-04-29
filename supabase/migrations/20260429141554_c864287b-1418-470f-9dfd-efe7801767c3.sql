-- 1) Trigger: ao mover attendee para outro slot no MESMO DIA, anular no-show e marcar como rescheduled.
CREATE OR REPLACE FUNCTION public.reset_attendee_status_on_same_day_move()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Mesmo dia: zera no_show / mantém como rescheduled
  IF old_date = new_date THEN
    NEW.status := 'rescheduled';
    NEW.is_reschedule := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_attendee_status_on_same_day_move ON public.meeting_slot_attendees;
CREATE TRIGGER trg_reset_attendee_status_on_same_day_move
BEFORE UPDATE OF meeting_slot_id ON public.meeting_slot_attendees
FOR EACH ROW
EXECUTE FUNCTION public.reset_attendee_status_on_same_day_move();

-- 2) Trigger adicional: se marcarem no_show DEPOIS de já ter movido no mesmo dia (race condition),
-- também anular. Detecta quando há movimento same-day registrado nos últimos 30 minutos.
CREATE OR REPLACE FUNCTION public.prevent_no_show_after_same_day_move()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_same_day_move boolean;
BEGIN
  -- Só age se o status novo for no_show e o anterior não era
  IF NEW.status <> 'no_show' OR OLD.status = 'no_show' THEN
    RETURN NEW;
  END IF;

  -- Houve movimento same_day_reschedule nos últimos 30min para este attendee?
  SELECT EXISTS (
    SELECT 1 FROM public.attendee_movement_logs
    WHERE attendee_id = NEW.id
      AND movement_type = 'same_day_reschedule'
      AND created_at > now() - interval '30 minutes'
  ) INTO recent_same_day_move;

  IF recent_same_day_move THEN
    NEW.status := 'rescheduled';
    NEW.is_reschedule := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_no_show_after_same_day_move ON public.meeting_slot_attendees;
CREATE TRIGGER trg_prevent_no_show_after_same_day_move
BEFORE UPDATE OF status ON public.meeting_slot_attendees
FOR EACH ROW
EXECUTE FUNCTION public.prevent_no_show_after_same_day_move();

-- 3) Correção retroativa abril/2026: attendees cujo ÚLTIMO movimento foi same-day e
-- ficaram com no_show herdado do slot anterior. Cruza data do slot atual com data do
-- from_scheduled_at do último movimento.
WITH last_mov AS (
  SELECT DISTINCT ON (attendee_id)
    attendee_id,
    from_scheduled_at,
    to_scheduled_at,
    movement_type,
    previous_status,
    created_at as moved_at
  FROM public.attendee_movement_logs
  WHERE created_at >= '2026-04-01' AND created_at < '2026-05-01'
  ORDER BY attendee_id, created_at DESC
),
ghosts AS (
  SELECT a.id
  FROM last_mov lm
  JOIN public.meeting_slot_attendees a ON a.id = lm.attendee_id
  WHERE a.status = 'no_show'
    AND lm.from_scheduled_at IS NOT NULL
    AND lm.to_scheduled_at IS NOT NULL
    AND (lm.from_scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date
        = (lm.to_scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date
    AND (
      lm.previous_status IN ('no_show','rescheduled')
      OR a.updated_at - lm.moved_at < interval '30 minutes'
    )
)
UPDATE public.meeting_slot_attendees
SET status = 'rescheduled', is_reschedule = true, updated_at = now()
WHERE id IN (SELECT id FROM ghosts);