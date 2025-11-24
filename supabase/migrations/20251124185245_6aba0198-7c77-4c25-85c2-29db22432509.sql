-- 1. Corrigir constraint de status para incluir 'processing'
ALTER TABLE sync_jobs 
DROP CONSTRAINT IF EXISTS sync_jobs_status_check;

ALTER TABLE sync_jobs 
ADD CONSTRAINT sync_jobs_status_check 
CHECK (status IN ('pending', 'processing', 'running', 'completed', 'failed', 'paused'));

-- 2. Configurar Cron Job para processar CSVs a cada 2 minutos
SELECT cron.schedule(
  'process-csv-imports',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/process-csv-imports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE'
    ),
    body := '{}'::jsonb
  );
  $$
);