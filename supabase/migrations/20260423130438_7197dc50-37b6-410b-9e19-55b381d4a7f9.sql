
-- 1. Create sdr_squad_history table
CREATE TABLE IF NOT EXISTS public.sdr_squad_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sdr_id UUID NOT NULL REFERENCES public.sdr(id) ON DELETE CASCADE,
  squad TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_squad_history_sdr_id ON public.sdr_squad_history(sdr_id);
CREATE INDEX IF NOT EXISTS idx_sdr_squad_history_squad_period ON public.sdr_squad_history(squad, valid_from, valid_to);

-- 2. Enable RLS
ALTER TABLE public.sdr_squad_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sdr_squad_history"
  ON public.sdr_squad_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages sdr_squad_history"
  ON public.sdr_squad_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Backfill: one open row per existing SDR with current squad
INSERT INTO public.sdr_squad_history (sdr_id, squad, valid_from, valid_to)
SELECT s.id, s.squad, s.created_at, NULL
FROM public.sdr s
WHERE s.squad IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.sdr_squad_history h WHERE h.sdr_id = s.id
  );

-- 4. Trigger: on squad change, close open row and insert new
CREATE OR REPLACE FUNCTION public.handle_sdr_squad_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.squad IS NOT NULL THEN
      INSERT INTO public.sdr_squad_history (sdr_id, squad, valid_from, valid_to)
      VALUES (NEW.id, NEW.squad, COALESCE(NEW.created_at, now()), NULL);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.squad, '') IS DISTINCT FROM COALESCE(NEW.squad, '') THEN
    -- Close any open row for this SDR
    UPDATE public.sdr_squad_history
       SET valid_to = now()
     WHERE sdr_id = NEW.id
       AND valid_to IS NULL;

    -- Open a new row with the new squad
    IF NEW.squad IS NOT NULL THEN
      INSERT INTO public.sdr_squad_history (sdr_id, squad, valid_from, valid_to)
      VALUES (NEW.id, NEW.squad, now(), NULL);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sdr_squad_change ON public.sdr;
CREATE TRIGGER trg_sdr_squad_change
AFTER INSERT OR UPDATE OF squad ON public.sdr
FOR EACH ROW
EXECUTE FUNCTION public.handle_sdr_squad_change();

-- 5. Helper function: SDRs that belonged to a squad during a period
CREATE OR REPLACE FUNCTION public.get_sdrs_for_squad_in_period(
  p_squad TEXT,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS TABLE (
  sdr_id UUID,
  email TEXT,
  name TEXT,
  current_squad TEXT,
  was_in_squad_during_period BOOLEAN,
  is_currently_in_squad BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    s.id AS sdr_id,
    s.email,
    s.name,
    s.squad AS current_squad,
    TRUE AS was_in_squad_during_period,
    (s.squad = p_squad) AS is_currently_in_squad
  FROM public.sdr s
  INNER JOIN public.sdr_squad_history h ON h.sdr_id = s.id
  WHERE s.active = true
    AND s.role_type = 'sdr'
    AND h.squad = p_squad
    AND h.valid_from <= p_end
    AND COALESCE(h.valid_to, 'infinity'::timestamptz) >= p_start
$$;

-- 6. Update RPC get_sdr_metrics_from_agenda (4-arg version) to use historical squad
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date text,
  end_date text,
  sdr_email_filter text DEFAULT NULL,
  bu_filter text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE result JSON;
BEGIN
  WITH raw_attendees AS (
    SELECT
      p_booker.email as sdr_email,
      COALESCE(p_booker.full_name, p_booker.email) as sdr_name,
      msa.deal_id,
      (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date as meeting_day,
      msa.status,
      msa.contract_paid_at,
      msa.parent_attendee_id,
      msa.is_reschedule,
      COALESCE(msa.booked_at, msa.created_at) as effective_booked_at,
      parent_msa.parent_attendee_id as parent_parent_id,
      sdr_at_time.id as sdr_id_at_booking,
      sdr_at_time.squad as sdr_squad_at_booking
    FROM meeting_slot_attendees msa
    INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN closers cl ON cl.id = ms.closer_id
    LEFT JOIN profiles p_booker ON p_booker.id = msa.booked_by
    LEFT JOIN meeting_slot_attendees parent_msa ON parent_msa.id = msa.parent_attendee_id
    -- Resolve SDR's squad at the moment of booking via history
    LEFT JOIN LATERAL (
      SELECT s.id, h.squad
      FROM public.sdr s
      INNER JOIN public.sdr_squad_history h ON h.sdr_id = s.id
      WHERE LOWER(s.email) = LOWER(p_booker.email)
        AND h.valid_from <= COALESCE(msa.booked_at, msa.created_at)
        AND COALESCE(h.valid_to, 'infinity'::timestamptz) > COALESCE(msa.booked_at, msa.created_at)
      ORDER BY h.valid_from DESC
      LIMIT 1
    ) sdr_at_time ON true
    WHERE msa.status != 'cancelled'
      AND ms.meeting_type = 'r1'
      AND msa.is_partner = false
      AND (sdr_email_filter IS NULL OR p_booker.email = sdr_email_filter)
      AND (
        bu_filter IS NULL
        OR sdr_at_time.squad = bu_filter
        OR (sdr_at_time.squad IS NULL AND cl.bu = bu_filter)
      )
      AND p_booker.email IS NOT NULL
  ),
  dedup_agendada AS (
    SELECT sdr_email, sdr_name, deal_id,
      LEAST(COUNT(DISTINCT meeting_day), 2) as agendada_count,
      MAX(CASE WHEN status IN ('completed','contract_paid','refunded') THEN 1 ELSE 0 END) as realized,
      MAX(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as is_noshow
    FROM raw_attendees
    WHERE meeting_day BETWEEN start_date::DATE AND end_date::DATE
    GROUP BY sdr_email, sdr_name, deal_id
  ),
  agendamentos_cte AS (
    SELECT sdr_email,
      COUNT(*) as agendamentos
    FROM raw_attendees
    WHERE (effective_booked_at AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN start_date::DATE AND end_date::DATE
      AND (
        (parent_attendee_id IS NULL AND COALESCE(is_reschedule, false) = false)
        OR (parent_attendee_id IS NOT NULL AND parent_parent_id IS NULL)
        OR (parent_attendee_id IS NULL AND is_reschedule = true)
      )
    GROUP BY sdr_email
  ),
  contratos_cte AS (
    SELECT sdr_email,
      COUNT(*) as contratos
    FROM raw_attendees
    WHERE (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN start_date::DATE AND end_date::DATE
    GROUP BY sdr_email
  ),
  sdr_universe AS (
    SELECT DISTINCT sdr_email, sdr_name
    FROM raw_attendees
    WHERE
      meeting_day BETWEEN start_date::DATE AND end_date::DATE
      OR (effective_booked_at AT TIME ZONE 'America/Sao_Paulo')::date
         BETWEEN start_date::DATE AND end_date::DATE
      OR (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date
         BETWEEN start_date::DATE AND end_date::DATE
  ),
  sdr_universe_dedup AS (
    SELECT sdr_email, MIN(sdr_name) as sdr_name
    FROM sdr_universe
    GROUP BY sdr_email
  ),
  dedup_agg AS (
    SELECT sdr_email,
      SUM(agendada_count)::int as r1_agendada,
      SUM(realized)::int as r1_realizada,
      SUM(is_noshow)::int as no_shows
    FROM dedup_agendada
    GROUP BY sdr_email
  ),
  sdr_stats AS (
    SELECT u.sdr_email, u.sdr_name,
      COALESCE(a.agendamentos, 0) as agendamentos,
      COALESCE(d.r1_agendada, 0) as r1_agendada,
      COALESCE(d.r1_realizada, 0) as r1_realizada,
      COALESCE(d.no_shows, 0) as no_shows,
      COALESCE(c.contratos, 0) as contratos
    FROM sdr_universe_dedup u
    LEFT JOIN dedup_agg d ON d.sdr_email = u.sdr_email
    LEFT JOIN agendamentos_cte a ON a.sdr_email = u.sdr_email
    LEFT JOIN contratos_cte c ON c.sdr_email = u.sdr_email
  )
  SELECT json_build_object(
    'metrics', COALESCE(json_agg(
      json_build_object(
        'sdr_email', sdr_email, 'sdr_name', sdr_name,
        'agendamentos', agendamentos,
        'r1_agendada', r1_agendada,
        'r1_realizada', r1_realizada,
        'no_shows', no_shows,
        'contratos', contratos
      ) ORDER BY agendamentos DESC NULLS LAST
    ), '[]'::json)
  ) INTO result FROM sdr_stats;

  RETURN COALESCE(result, json_build_object('metrics', '[]'::json));
END;
$function$;
