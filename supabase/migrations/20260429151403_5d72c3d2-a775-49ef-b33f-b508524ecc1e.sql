
-- 1. Política de INSERT no bucket no-show-evidence (cada user só escreve na própria pasta)
CREATE POLICY "Users can upload their own no-show evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'no-show-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Trigger BEFORE INSERT em no_show_validations: derivar human_overrode_ai server-side
CREATE OR REPLACE FUNCTION public.derive_no_show_override()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Força performed_by = usuário autenticado (impede falsificação)
  IF auth.uid() IS NOT NULL THEN
    NEW.performed_by := auth.uid();
  END IF;

  -- human_overrode_ai sempre derivado: TRUE se IA disse not_no_show e humano marcou no_show
  NEW.human_overrode_ai := (NEW.ai_verdict = 'not_no_show' AND NEW.human_decision = 'no_show');

  -- Justificativa obrigatória em override
  IF NEW.human_overrode_ai AND (NEW.human_justification IS NULL OR length(trim(NEW.human_justification)) < 10) THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres) ao discordar da IA';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_derive_no_show_override ON public.no_show_validations;
CREATE TRIGGER trg_derive_no_show_override
BEFORE INSERT ON public.no_show_validations
FOR EACH ROW EXECUTE FUNCTION public.derive_no_show_override();

-- 3. Trigger BEFORE UPDATE em meeting_slot_attendees: bloquear no_show sem evidência válida
CREATE OR REPLACE FUNCTION public.enforce_no_show_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settings record;
  v_validation record;
  v_is_leadership boolean;
  v_is_restricted boolean;
BEGIN
  -- Só age quando o status MUDA para no_show
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status <> 'no_show' THEN
    RETURN NEW;
  END IF;

  -- Sem usuário autenticado (ex: edge function com service role) → libera
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Liderança passa direto
  v_is_leadership := has_role(v_uid, 'admin'::app_role)
                  OR has_role(v_uid, 'manager'::app_role)
                  OR has_role(v_uid, 'coordenador'::app_role);
  IF v_is_leadership THEN
    RETURN NEW;
  END IF;

  -- Aplica apenas a SDR / Closer / Closer Sombra
  v_is_restricted := has_role(v_uid, 'sdr'::app_role)
                  OR has_role(v_uid, 'closer'::app_role)
                  OR has_role(v_uid, 'closer_sombra'::app_role);
  IF NOT v_is_restricted THEN
    RETURN NEW;
  END IF;

  -- Lê configuração global
  SELECT * INTO v_settings FROM public.no_show_ai_settings WHERE id = 1;

  -- Se evidência não é exigida, libera
  IF v_settings IS NULL OR COALESCE(v_settings.require_evidence, true) = false THEN
    RETURN NEW;
  END IF;

  -- Procura validação recente (últimos 5 min) deste usuário para este attendee
  SELECT * INTO v_validation
  FROM public.no_show_validations
  WHERE attendee_id = NEW.id
    AND performed_by = v_uid
    AND created_at >= now() - interval '5 minutes'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_validation IS NULL THEN
    RAISE EXCEPTION 'Marcação de No-Show requer print da conversa analisado pela IA. Use o botão No-Show no fluxo padrão.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Modo "block": IA disse not_no_show → bloqueia mesmo com print
  IF v_settings.mode = 'block' AND v_validation.ai_verdict = 'not_no_show' THEN
    RAISE EXCEPTION 'A IA determinou que esta conversa NÃO caracteriza No-Show. Marcação bloqueada (modo block).'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_no_show_evidence ON public.meeting_slot_attendees;
CREATE TRIGGER trg_enforce_no_show_evidence
BEFORE UPDATE OF status ON public.meeting_slot_attendees
FOR EACH ROW EXECUTE FUNCTION public.enforce_no_show_evidence();

-- 4. Mesmo enforcement em meeting_slots (caso o status seja sincronizado)
CREATE OR REPLACE FUNCTION public.enforce_no_show_evidence_slot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settings record;
  v_validation record;
  v_is_leadership boolean;
  v_is_restricted boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status <> 'no_show' THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN RETURN NEW; END IF;

  v_is_leadership := has_role(v_uid, 'admin'::app_role)
                  OR has_role(v_uid, 'manager'::app_role)
                  OR has_role(v_uid, 'coordenador'::app_role);
  IF v_is_leadership THEN RETURN NEW; END IF;

  v_is_restricted := has_role(v_uid, 'sdr'::app_role)
                  OR has_role(v_uid, 'closer'::app_role)
                  OR has_role(v_uid, 'closer_sombra'::app_role);
  IF NOT v_is_restricted THEN RETURN NEW; END IF;

  SELECT * INTO v_settings FROM public.no_show_ai_settings WHERE id = 1;
  IF v_settings IS NULL OR COALESCE(v_settings.require_evidence, true) = false THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_validation
  FROM public.no_show_validations
  WHERE meeting_slot_id = NEW.id
    AND performed_by = v_uid
    AND created_at >= now() - interval '5 minutes'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_validation IS NULL THEN
    RAISE EXCEPTION 'Marcação de No-Show requer print da conversa analisado pela IA.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_settings.mode = 'block' AND v_validation.ai_verdict = 'not_no_show' THEN
    RAISE EXCEPTION 'A IA determinou que esta conversa NÃO caracteriza No-Show. Marcação bloqueada.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_no_show_evidence_slot ON public.meeting_slots;
CREATE TRIGGER trg_enforce_no_show_evidence_slot
BEFORE UPDATE OF status ON public.meeting_slots
FOR EACH ROW EXECUTE FUNCTION public.enforce_no_show_evidence_slot();
