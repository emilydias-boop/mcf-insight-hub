SELECT cron.schedule(
  'weekly-manager-report',
  '30 10 * * 1',
  $$
  SELECT net.http_post(
    url:='https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/weekly-manager-report',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE"}'::jsonb,
    body:='{"time": "scheduled"}'::jsonb
  ) AS request_id;
  $$
);