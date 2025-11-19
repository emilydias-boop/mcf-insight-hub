-- Criar tabela para controlar estado das sincronizações
CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('contacts', 'deals', 'origins_stages', 'link_contacts')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused')),
  last_page INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  total_skipped INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_sync_jobs_type_status ON public.sync_jobs(job_type, status);
CREATE INDEX idx_sync_jobs_updated_at ON public.sync_jobs(updated_at DESC);

-- RLS policies
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sync jobs"
  ON public.sync_jobs FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage sync jobs"
  ON public.sync_jobs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sync_jobs_updated_at
  BEFORE UPDATE ON public.sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Ativar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurar cron job para sincronizar contatos a cada 5 minutos
SELECT cron.schedule(
  'sync-contacts-cron',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT
    net.http_post(
      url:='https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/sync-contacts',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE"}'::jsonb,
      body:='{"auto_mode": true}'::jsonb
    ) as request_id;
  $$
);

-- Configurar cron job para sincronizar deals a cada 10 minutos
SELECT cron.schedule(
  'sync-deals-cron',
  '*/10 * * * *', -- A cada 10 minutos
  $$
  SELECT
    net.http_post(
      url:='https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/sync-deals',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE"}'::jsonb,
      body:='{"auto_mode": true}'::jsonb
    ) as request_id;
  $$
);