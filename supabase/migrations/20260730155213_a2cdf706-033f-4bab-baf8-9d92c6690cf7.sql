CREATE OR REPLACE FUNCTION public.notify_mcf_pay_on_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  new_is_won boolean;
  old_is_won boolean;
BEGIN
  IF NEW.stage_id IS NULL OR NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT is_won_stage INTO new_is_won FROM public.crm_stages WHERE id = NEW.stage_id;
  SELECT is_won_stage INTO old_is_won FROM public.crm_stages WHERE id = OLD.stage_id;

  IF COALESCE(new_is_won,false) = true AND COALESCE(old_is_won,false) = false THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/notify-mcf-pay',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := jsonb_build_object('deal_id', NEW.id, 'trigger', 'stage_change')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_mcf_pay_on_won falhou: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;