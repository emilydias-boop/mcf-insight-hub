
CREATE TABLE IF NOT EXISTS public.late_status_change_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_id uuid,
  slot_id uuid,
  meeting_scheduled_at timestamptz,
  ano_mes text,
  old_status text,
  new_status text,
  days_after_meeting integer,
  was_blocked boolean NOT NULL DEFAULT false,
  block_reason text,
  attempted_by uuid,
  attempted_by_email text,
  attempted_by_role text,
  attendee_name text,
  closer_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_late_status_attempts_ano_mes ON public.late_status_change_attempts(ano_mes);
CREATE INDEX IF NOT EXISTS idx_late_status_attempts_blocked ON public.late_status_change_attempts(was_blocked);
CREATE INDEX IF NOT EXISTS idx_late_status_attempts_created ON public.late_status_change_attempts(created_at DESC);

ALTER TABLE public.late_status_change_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manager coord read late attempts"
ON public.late_status_change_attempts FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'coordenador')
);

-- Sem policy de INSERT direta -- só o trigger (SECURITY DEFINER) pode inserir.

-- Atualiza o trigger para também REGISTRAR a tentativa
CREATE OR REPLACE FUNCTION public.enforce_meeting_status_lock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ano_mes text;
  v_scheduled timestamptz;
  v_days int;
  v_locked boolean;
  v_is_privileged boolean;
  v_blocked boolean := false;
  v_reason text := NULL;
  v_email text;
  v_role text;
  v_closer text;
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
  v_days := (now()::date - v_scheduled::date);
  v_locked := public.is_month_locked(v_ano_mes);
  v_is_privileged := public.has_role(auth.uid(), 'admin')
                  OR public.has_role(auth.uid(), 'manager')
                  OR public.has_role(auth.uid(), 'coordenador');

  -- Determina bloqueio
  IF v_locked AND NOT v_is_privileged THEN
    v_blocked := true;
    v_reason := 'Mês ' || v_ano_mes || ' está fechado';
  END IF;

  -- Registra TODA tentativa após o dia da reunião (sucesso ou bloqueio)
  IF v_days >= 1 THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
    SELECT string_agg(role::text, ', ') INTO v_role FROM public.user_roles WHERE user_id = auth.uid();
    SELECT c.name INTO v_closer
      FROM public.meeting_slots ms
      LEFT JOIN public.closers c ON c.id = ms.closer_id
      WHERE ms.id = NEW.meeting_slot_id;

    INSERT INTO public.late_status_change_attempts (
      attendee_id, slot_id, meeting_scheduled_at, ano_mes,
      old_status, new_status, days_after_meeting, was_blocked, block_reason,
      attempted_by, attempted_by_email, attempted_by_role,
      attendee_name, closer_name
    ) VALUES (
      NEW.id, NEW.meeting_slot_id, v_scheduled, v_ano_mes,
      OLD.status, NEW.status, v_days, v_blocked, v_reason,
      auth.uid(), v_email, v_role,
      NEW.attendee_name, v_closer
    );
  END IF;

  IF v_blocked THEN
    RAISE EXCEPTION
      'Mês % está fechado. Alterações de status estão bloqueadas. Solicite ao gestor/admin para reabrir.',
      v_ano_mes
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
