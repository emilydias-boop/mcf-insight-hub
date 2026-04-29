CREATE OR REPLACE FUNCTION public.derive_no_show_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_justif text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.performed_by := auth.uid();
  END IF;

  NEW.human_overrode_ai := (NEW.ai_verdict = 'not_no_show' AND NEW.human_decision = 'no_show');

  IF NEW.human_overrode_ai THEN
    v_justif := COALESCE(NULLIF(trim(NEW.sdr_justification), ''), NULLIF(trim(NEW.human_justification), ''));
    IF v_justif IS NULL OR length(v_justif) < 20 THEN
      RAISE EXCEPTION 'Justificativa obrigatória (mínimo 20 caracteres) ao contestar a decisão da IA';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;