
-- 1. Trigger to invoke processor immediately when a pending item is enqueued
CREATE OR REPLACE FUNCTION public.trg_automation_queue_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW.scheduled_at <= now() + interval '10 seconds' THEN
    PERFORM net.http_post(
      url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/automation-processor',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE"}'::jsonb,
      body := jsonb_build_object('triggered_by','queue_insert','queue_item_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the insert if the http_post fails; cron picks it up.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_queue_dispatch_after_insert ON public.automation_queue;
CREATE TRIGGER automation_queue_dispatch_after_insert
AFTER INSERT ON public.automation_queue
FOR EACH ROW
EXECUTE FUNCTION public.trg_automation_queue_dispatch();

-- 2. Reschedule cron from every 5 min to every 1 min (safety net)
SELECT cron.unschedule('process-automation-queue');
SELECT cron.schedule(
  'process-automation-queue',
  '* * * * *',
  $CRON$
  select net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/automation-processor',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE"}'::jsonb,
    body := '{"triggered_by":"cron"}'::jsonb
  ) as request_id;
  $CRON$
);
