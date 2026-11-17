create or replace function public.auditoria_cron_disparar(p_body jsonb default '{}'::jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  insert into public.auditoria_cron_tickets(token_hash,expires_at) values(encode(extensions.digest(v_token,'sha256'),'hex'),now()+interval '5 minutes');
  perform net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/auditoria-diaria-email',
    headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE','x-auditoria-cron-token',v_token),
    body := coalesce(p_body,'{}'::jsonb)
  );
end; $$;
revoke all on function public.auditoria_cron_disparar(jsonb) from public, anon, authenticated;
grant execute on function public.auditoria_cron_disparar(jsonb) to service_role;