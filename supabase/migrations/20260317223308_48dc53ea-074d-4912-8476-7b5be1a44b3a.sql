SELECT cron.schedule(
  'move-partners-to-venda-realizada',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/move-partners-to-venda-realizada',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    ),
    body := '{"dry_run": false}'::jsonb
  );
  $$
);