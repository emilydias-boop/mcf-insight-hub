
CREATE TABLE IF NOT EXISTS public.meeting_status_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_mes text NOT NULL UNIQUE,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by uuid REFERENCES auth.users(id),
  locked_reason text,
  unlocked_at timestamptz,
  unlocked_by uuid REFERENCES auth.users(id),
  unlocked_reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_status_locks_active
  ON public.meeting_status_locks(ano_mes) WHERE is_active = true;

ALTER TABLE public.meeting_status_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users can read locks"
ON public.meeting_status_locks FOR SELECT
TO authenticated USING (true);

CREATE POLICY "admin manager coord manage locks"
ON public.meeting_status_locks FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'coordenador')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'coordenador')
);

CREATE OR REPLACE FUNCTION public.is_month_locked(_ano_mes text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meeting_status_locks
    WHERE ano_mes = _ano_mes AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.lock_month(_ano_mes text, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.meeting_status_locks (ano_mes, locked_by, locked_reason, is_active)
  VALUES (_ano_mes, auth.uid(), _reason, true)
  ON CONFLICT (ano_mes) DO UPDATE
    SET is_active = true,
        locked_at = CASE WHEN public.meeting_status_locks.is_active THEN public.meeting_status_locks.locked_at ELSE now() END,
        locked_by = CASE WHEN public.meeting_status_locks.is_active THEN public.meeting_status_locks.locked_by ELSE auth.uid() END,
        locked_reason = CASE WHEN public.meeting_status_locks.is_active THEN public.meeting_status_locks.locked_reason ELSE _reason END,
        unlocked_at = NULL,
        unlocked_by = NULL,
        unlocked_reason = NULL,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_meeting_status_lock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ano_mes text;
  v_scheduled timestamptz;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT scheduled_at INTO v_scheduled
  FROM public.meeting_slots WHERE id = NEW.meeting_slot_id;

  IF v_scheduled IS NULL THEN
    RETURN NEW;
  END IF;

  v_ano_mes := to_char(v_scheduled, 'YYYY-MM');

  IF public.is_month_locked(v_ano_mes) THEN
    IF public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'manager')
       OR public.has_role(auth.uid(), 'coordenador') THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Mês % está fechado. Alterações de status estão bloqueadas. Solicite ao gestor/admin para reabrir.',
      v_ano_mes
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_meeting_status_lock ON public.meeting_slot_attendees;
CREATE TRIGGER trg_enforce_meeting_status_lock
  BEFORE UPDATE ON public.meeting_slot_attendees
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_meeting_status_lock();

CREATE OR REPLACE FUNCTION public.auto_lock_month_on_payout_approval()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ano_mes text;
  v_origem text;
BEGIN
  IF NEW.status <> 'APPROVED' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' THEN
    RETURN NEW;
  END IF;

  v_ano_mes := NEW.ano_mes;
  v_origem  := CASE WHEN TG_TABLE_NAME = 'sdr_month_payout' THEN 'Fechamento SDR aprovado'
                    ELSE 'Fechamento Closer aprovado' END;

  IF v_ano_mes IS NOT NULL THEN
    PERFORM public.lock_month(v_ano_mes, v_origem);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_lock_sdr_payout ON public.sdr_month_payout;
CREATE TRIGGER trg_auto_lock_sdr_payout
  AFTER INSERT OR UPDATE OF status ON public.sdr_month_payout
  FOR EACH ROW EXECUTE FUNCTION public.auto_lock_month_on_payout_approval();

DROP TRIGGER IF EXISTS trg_auto_lock_closer_payout ON public.consorcio_closer_payout;
CREATE TRIGGER trg_auto_lock_closer_payout
  AFTER INSERT OR UPDATE OF status ON public.consorcio_closer_payout
  FOR EACH ROW EXECUTE FUNCTION public.auto_lock_month_on_payout_approval();

INSERT INTO public.meeting_status_locks (ano_mes, locked_reason, is_active)
SELECT DISTINCT ano_mes, 'Backfill: payout SDR já aprovado', true
FROM public.sdr_month_payout
WHERE status = 'APPROVED' AND ano_mes IS NOT NULL
ON CONFLICT (ano_mes) DO NOTHING;

INSERT INTO public.meeting_status_locks (ano_mes, locked_reason, is_active)
SELECT DISTINCT ano_mes, 'Backfill: payout Closer já aprovado', true
FROM public.consorcio_closer_payout
WHERE status = 'APPROVED' AND ano_mes IS NOT NULL
ON CONFLICT (ano_mes) DO NOTHING;
