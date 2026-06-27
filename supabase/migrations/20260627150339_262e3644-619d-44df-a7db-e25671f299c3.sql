
-- 1. Profiles: códigos MCF Pay
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mcf_pay_closer_code text,
  ADD COLUMN IF NOT EXISTS mcf_pay_sdr_code text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_mcf_pay_closer_code_uk
  ON public.profiles (mcf_pay_closer_code) WHERE mcf_pay_closer_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_mcf_pay_sdr_code_uk
  ON public.profiles (mcf_pay_sdr_code) WHERE mcf_pay_sdr_code IS NOT NULL;

-- 2. crm_stages: flag is_won_stage
ALTER TABLE public.crm_stages
  ADD COLUMN IF NOT EXISTS is_won_stage boolean NOT NULL DEFAULT false;

UPDATE public.crm_stages
   SET is_won_stage = true
 WHERE stage_name IN (
   'Fechado','Contrato Pago','Contrato na Mão','Contrato Consórcio',
   'PRODUTOS FECHADOS','CONTRATO PAGO','SELECT - Parceiro Pagou',
   'PARCELINHA - MCF Pagou'
 );

-- 3. Tabela de configuração (singleton)
CREATE TABLE IF NOT EXISTS public.mcf_pay_config (
  id boolean PRIMARY KEY DEFAULT true,
  webhook_url text,
  is_active boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcf_pay_config_singleton CHECK (id = true)
);

GRANT SELECT, INSERT, UPDATE ON public.mcf_pay_config TO authenticated;
GRANT ALL ON public.mcf_pay_config TO service_role;
ALTER TABLE public.mcf_pay_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read mcf_pay_config"
  ON public.mcf_pay_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins write mcf_pay_config"
  ON public.mcf_pay_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.mcf_pay_config (id, is_active)
  VALUES (true, false)
  ON CONFLICT (id) DO NOTHING;

-- 4. Tabela de logs / fila de envio
CREATE TABLE IF NOT EXISTS public.mcf_pay_dispatch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid,
  event text NOT NULL DEFAULT 'deal.paid',
  status text NOT NULL DEFAULT 'pending',
    -- pending | success | failed | skipped_no_codes | skipped_inactive
  attempt int NOT NULL DEFAULT 0,
  http_status int,
  payload jsonb,
  response jsonb,
  signature_preview text,
  error_message text,
  next_retry_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcf_pay_logs_deal_idx ON public.mcf_pay_dispatch_logs(deal_id);
CREATE INDEX IF NOT EXISTS mcf_pay_logs_status_idx ON public.mcf_pay_dispatch_logs(status, next_retry_at);
CREATE INDEX IF NOT EXISTS mcf_pay_logs_created_idx ON public.mcf_pay_dispatch_logs(created_at DESC);

GRANT SELECT ON public.mcf_pay_dispatch_logs TO authenticated;
GRANT ALL ON public.mcf_pay_dispatch_logs TO service_role;
ALTER TABLE public.mcf_pay_dispatch_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read mcf_pay_logs"
  ON public.mcf_pay_dispatch_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Trigger: ao entrar em is_won_stage=true, dispara a edge function
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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
    PERFORM extensions.http_post(
      url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/notify-mcf-pay',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('deal_id', NEW.id, 'trigger', 'stage_change')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_mcf_pay_on_won ON public.crm_deals;
CREATE TRIGGER trg_notify_mcf_pay_on_won
  AFTER UPDATE OF stage_id ON public.crm_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_mcf_pay_on_won();

-- 6. Cron de retries a cada 5 minutos
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule('mcf-pay-retry-queue');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'mcf-pay-retry-queue',
  '*/5 * * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/notify-mcf-pay',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"retry_queue":true}'::jsonb
  );
  $$
);
