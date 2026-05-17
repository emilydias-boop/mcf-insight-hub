
-- Garantir extensões
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remover jobs antigos se existirem (idempotente)
do $$
begin
  perform cron.unschedule('process-automation-queue');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('poll-twilio-template-status');
exception when others then null;
end $$;

-- 1) Processar fila de automações a cada 5 minutos
select cron.schedule(
  'process-automation-queue',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/automation-processor',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- 2) Atualizar status de templates pendentes na Meta a cada 30 minutos
select cron.schedule(
  'poll-twilio-template-status',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/twilio-content-status-poll',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
