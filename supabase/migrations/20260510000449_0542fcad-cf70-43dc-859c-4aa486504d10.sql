-- Onda 3.1: Recalcular automation_queue quando meeting é remarcada

-- 1. Função de recálculo
CREATE OR REPLACE FUNCTION public.recalc_automation_queue_for_deal(
  p_deal_id uuid,
  p_new_anchor_at timestamptz,
  p_anchor_kind text  -- 'meeting_start' or 'meeting_end'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_delay_total_min integer;
  v_new_scheduled timestamptz;
  v_min_lead_cutoff timestamptz := now() + interval '15 minutes';
  v_stage_name text;
  v_detected_kind text;
  v_direction text;  -- 'before' or 'after'
BEGIN
  IF p_deal_id IS NULL OR p_new_anchor_at IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT q.id AS queue_id,
           s.delay_days, s.delay_hours, s.delay_minutes,
           f.stage_id,
           cs.stage_name
    FROM public.automation_queue q
    JOIN public.automation_steps s ON s.id = q.step_id
    JOIN public.automation_flows f ON f.id = q.flow_id
    LEFT JOIN public.crm_stages cs ON cs.id = f.stage_id
    WHERE q.deal_id = p_deal_id
      AND q.status = 'pending'
  LOOP
    v_stage_name := lower(coalesce(r.stage_name, ''));
    -- Remove acentos básicos
    v_stage_name := translate(v_stage_name,
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc');

    -- Detecta âncora pelo nome do stage (mesma lógica do enqueue)
    IF v_stage_name ~ '(reuniao|r1|r2|1a reuniao).*(agendad|agendamento)' THEN
      v_detected_kind := 'meeting_start';
      v_direction := 'before';
    ELSIF v_stage_name ~ '(reuniao|r1|r2).*realizad' THEN
      v_detected_kind := 'meeting_end';
      v_direction := 'after';
    ELSE
      v_detected_kind := NULL;
    END IF;

    -- Só recalcula se o stage for ancorado em meeting E bater com o kind do trigger
    IF v_detected_kind IS NULL OR v_detected_kind <> p_anchor_kind THEN
      CONTINUE;
    END IF;

    v_delay_total_min :=
      coalesce(r.delay_days, 0) * 1440
      + coalesce(r.delay_hours, 0) * 60
      + coalesce(r.delay_minutes, 0);

    IF v_direction = 'before' THEN
      v_new_scheduled := p_new_anchor_at - make_interval(mins => v_delay_total_min);
    ELSE
      v_new_scheduled := p_new_anchor_at + make_interval(mins => v_delay_total_min);
    END IF;

    IF v_new_scheduled < v_min_lead_cutoff THEN
      UPDATE public.automation_queue
      SET status = 'skipped',
          error_message = 'reschedule_too_close'
      WHERE id = r.queue_id;
    ELSE
      UPDATE public.automation_queue
      SET scheduled_at = v_new_scheduled,
          error_message = NULL
      WHERE id = r.queue_id
        AND scheduled_at IS DISTINCT FROM v_new_scheduled;
    END IF;
  END LOOP;
END;
$$;

-- 2. Trigger function em meeting_slots
CREATE OR REPLACE FUNCTION public.trg_meeting_slots_reschedule_recalc_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting_end timestamptz;
  v_should_recalc boolean := false;
  v_has_prev_rescheduled boolean;
BEGIN
  -- Só interessa slot ativo
  IF NEW.status IN ('cancelled', 'no_show', 'rescheduled') THEN
    RETURN NEW;
  END IF;
  IF NEW.deal_id IS NULL OR NEW.scheduled_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Só dispara se houver slot anterior do mesmo deal já rescheduled (= é uma remarcação real)
    SELECT EXISTS (
      SELECT 1 FROM public.meeting_slots
      WHERE deal_id = NEW.deal_id
        AND id <> NEW.id
        AND status = 'rescheduled'
    ) INTO v_has_prev_rescheduled;
    v_should_recalc := v_has_prev_rescheduled;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at THEN
      v_should_recalc := true;
    END IF;
  END IF;

  IF NOT v_should_recalc THEN
    RETURN NEW;
  END IF;

  v_meeting_end := NEW.scheduled_at + make_interval(mins => coalesce(NEW.duration_minutes, 60));

  PERFORM public.recalc_automation_queue_for_deal(NEW.deal_id, NEW.scheduled_at, 'meeting_start');
  PERFORM public.recalc_automation_queue_for_deal(NEW.deal_id, v_meeting_end, 'meeting_end');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meeting_slots_reschedule_recalc ON public.meeting_slots;
CREATE TRIGGER trg_meeting_slots_reschedule_recalc
AFTER INSERT OR UPDATE ON public.meeting_slots
FOR EACH ROW
EXECUTE FUNCTION public.trg_meeting_slots_reschedule_recalc_fn();