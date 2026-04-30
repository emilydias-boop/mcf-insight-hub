CREATE OR REPLACE FUNCTION public.enforce_no_show_evidence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_settings record;
  v_validation record;
  v_is_leadership boolean;
  v_is_closer boolean;
  v_is_sdr boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status <> 'no_show' THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_leadership := has_role(v_uid, 'admin'::app_role)
                  OR has_role(v_uid, 'manager'::app_role)
                  OR has_role(v_uid, 'coordenador'::app_role);
  IF v_is_leadership THEN
    RETURN NEW;
  END IF;

  -- Closer / Closer Sombra passam direto, mesmo se também tiverem SDR.
  v_is_closer := has_role(v_uid, 'closer'::app_role)
              OR has_role(v_uid, 'closer_sombra'::app_role);
  IF v_is_closer THEN
    RETURN NEW;
  END IF;

  v_is_sdr := has_role(v_uid, 'sdr'::app_role);
  IF NOT v_is_sdr THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_settings FROM public.no_show_ai_settings WHERE id = 1;

  IF v_settings IS NULL OR COALESCE(v_settings.require_evidence, true) = false THEN
    RETURN NEW;
  END IF;

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

  IF v_settings.mode = 'block' AND v_validation.ai_verdict = 'not_no_show' THEN
    RAISE EXCEPTION 'A IA determinou que esta conversa NÃO caracteriza No-Show. Marcação bloqueada (modo block).'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;