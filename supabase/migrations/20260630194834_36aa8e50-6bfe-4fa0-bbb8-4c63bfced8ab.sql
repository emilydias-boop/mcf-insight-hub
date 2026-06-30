
ALTER TABLE public.mcf_pay_dispatch_logs
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_mcf_pay_dispatch_logs_deal_status
  ON public.mcf_pay_dispatch_logs(deal_id, status);

CREATE OR REPLACE FUNCTION public.trigger_notify_mcf_pay_on_contract_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_url text := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/notify-mcf-pay';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE';
BEGIN
  IF NEW.contract_paid_at IS NOT NULL
     AND NEW.deal_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.contract_paid_at IS DISTINCT FROM NEW.contract_paid_at) THEN
    PERFORM net.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'apikey', anon_key
      ),
      body := jsonb_build_object(
        'deal_id', NEW.deal_id::text,
        'source', 'auto_contract_paid'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_mcf_pay_on_contract_paid ON public.meeting_slot_attendees;
CREATE TRIGGER trg_notify_mcf_pay_on_contract_paid
AFTER INSERT OR UPDATE OF contract_paid_at ON public.meeting_slot_attendees
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notify_mcf_pay_on_contract_paid();
