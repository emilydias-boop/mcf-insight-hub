CREATE OR REPLACE FUNCTION public.notify_crm_externo_admissao_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
BEGIN
  IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN RETURN NEW; END IF;
  IF COALESCE(NEW.custom_fields->>'encaminhamento_external_id','') NOT LIKE 'admissao:%' THEN RETURN NEW; END IF;
  BEGIN
    PERFORM net.http_post(
      url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/crm-externo-callback',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('deal_id', NEW.id, 'operador_profile_id', auth.uid())
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_crm_externo_admissao_status falhou: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_crm_externo_admissao_status
AFTER UPDATE OF stage_id ON public.crm_deals
FOR EACH ROW EXECUTE FUNCTION public.notify_crm_externo_admissao_status();