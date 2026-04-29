UPDATE public.no_show_validations
SET ai_verdict = CASE ai_verdict
  WHEN 'confirmed_no_show' THEN 'confirmed'
  WHEN 'uncertain' THEN 'inconclusive'
  ELSE ai_verdict
END
WHERE ai_verdict IN ('confirmed_no_show', 'uncertain');

ALTER TABLE public.no_show_validations
DROP CONSTRAINT IF EXISTS no_show_validations_ai_verdict_check;

ALTER TABLE public.no_show_validations
ADD CONSTRAINT no_show_validations_ai_verdict_check
CHECK (ai_verdict IN ('confirmed', 'not_no_show', 'inconclusive', 'error'));

CREATE OR REPLACE FUNCTION public.derive_no_show_override()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.performed_by := auth.uid();
  END IF;

  NEW.human_overrode_ai := (NEW.ai_verdict = 'not_no_show' AND NEW.human_decision = 'no_show');

  IF NEW.human_overrode_ai AND (
    COALESCE(length(trim(NEW.sdr_justification)), 0) < 20
    AND COALESCE(length(trim(NEW.human_justification)), 0) < 10
  ) THEN
    RAISE EXCEPTION 'Justificativa obrigatória ao discordar da IA';
  END IF;

  RETURN NEW;
END;
$$;