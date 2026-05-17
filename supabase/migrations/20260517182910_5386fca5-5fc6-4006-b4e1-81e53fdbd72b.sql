
-- 1) Atualiza a função para usar anon key (a edge function tem verify_jwt=false)
CREATE OR REPLACE FUNCTION public.trigger_automation_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  IF NEW.stage_id IS NULL OR NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/automation-enqueue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE'
    ),
    body := jsonb_build_object(
      'dealId', NEW.id,
      'contactId', NEW.contact_id,
      'newStageId', NEW.stage_id,
      'oldStageId', CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage_id ELSE NULL END,
      'originId', NEW.origin_id,
      'triggerType', 'enter'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[automation-enqueue trigger] %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 2) Anexa o trigger no crm_deals
DROP TRIGGER IF EXISTS trg_automation_enqueue_on_deal ON public.crm_deals;
CREATE TRIGGER trg_automation_enqueue_on_deal
AFTER INSERT OR UPDATE OF stage_id ON public.crm_deals
FOR EACH ROW
EXECUTE FUNCTION public.trigger_automation_enqueue();
