ALTER TABLE public.no_show_validations
  ADD COLUMN IF NOT EXISTS meeting_type text NOT NULL DEFAULT 'R1' CHECK (meeting_type IN ('R1','R2')),
  ADD COLUMN IF NOT EXISTS sdr_justification text,
  ADD COLUMN IF NOT EXISTS manager_review_status text CHECK (manager_review_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS manager_review_by uuid,
  ADD COLUMN IF NOT EXISTS manager_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_review_notes text,
  ADD COLUMN IF NOT EXISTS final_status text CHECK (final_status IN ('approved','blocked','pending_review'));

CREATE INDEX IF NOT EXISTS idx_no_show_validations_pending_review
  ON public.no_show_validations (manager_review_status, created_at DESC)
  WHERE manager_review_status = 'pending';

DROP POLICY IF EXISTS "Managers can review pending no-shows" ON public.no_show_validations;
CREATE POLICY "Managers can review pending no-shows"
  ON public.no_show_validations
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
  );

DROP POLICY IF EXISTS "Managers can view all no-show validations" ON public.no_show_validations;
CREATE POLICY "Managers can view all no-show validations"
  ON public.no_show_validations
  FOR SELECT
  TO authenticated
  USING (
    performed_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

CREATE OR REPLACE FUNCTION public.check_no_show_has_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validation public.no_show_validations%ROWTYPE;
  v_settings_mode text;
  v_require_evidence boolean;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'no_show' THEN
    RETURN NEW;
  END IF;

  SELECT mode, require_evidence INTO v_settings_mode, v_require_evidence
  FROM public.no_show_ai_settings WHERE id = 1;

  IF v_settings_mode IS NULL OR v_settings_mode = 'audit' OR v_require_evidence IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_validation
  FROM public.no_show_validations
  WHERE attendee_id = NEW.id
    AND created_at > now() - interval '15 minutes'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_validation.id IS NULL THEN
    RAISE EXCEPTION 'No-show requer validação por IA. Faça upload do print da conversa.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_validation.ai_verdict = 'confirmed' THEN
    RETURN NEW;
  ELSIF v_validation.ai_verdict = 'inconclusive' AND COALESCE(length(trim(v_validation.sdr_justification)), 0) > 0 THEN
    RETURN NEW;
  ELSIF v_validation.manager_review_status = 'approved' THEN
    RETURN NEW;
  ELSIF v_validation.ai_verdict = 'not_no_show' AND v_validation.manager_review_status = 'pending' THEN
    RAISE EXCEPTION 'No-show contestado aguardando aprovação do gestor.'
      USING ERRCODE = 'P0001';
  ELSE
    RAISE EXCEPTION 'Validação da IA não autoriza no-show (verdict: %). Use o fluxo de contestação se discordar.', v_validation.ai_verdict
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;