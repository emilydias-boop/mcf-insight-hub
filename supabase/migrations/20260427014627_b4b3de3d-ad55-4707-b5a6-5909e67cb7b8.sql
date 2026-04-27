-- Remove o cron job quebrado (estava falhando com "unrecognized configuration parameter supabase.service_role_key")
SELECT cron.unschedule('move-partners-to-venda-realizada');

-- Recria com header Authorization válido (anon key — a edge function usa SERVICE_ROLE_KEY internamente via Deno.env)
SELECT cron.schedule(
  'move-partners-to-venda-realizada',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/move-partners-to-venda-realizada',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE"}'::jsonb,
    body := '{"dry_run": false}'::jsonb
  );
  $$
);