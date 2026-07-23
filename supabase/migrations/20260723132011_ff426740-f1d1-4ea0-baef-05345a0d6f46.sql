CREATE OR REPLACE VIEW public.v_automation_confirmacao_r1_health AS
SELECT
  date_trunc('day', created_at) AS day,
  status,
  COALESCE(error_message, '—') AS reason,
  COUNT(*)::int AS qtd
FROM public.automation_queue
WHERE flow_id = 'a8d14cba-406b-4c11-8a6c-47e4e43444dd'
  AND created_at > now() - interval '14 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;

GRANT SELECT ON public.v_automation_confirmacao_r1_health TO authenticated, service_role;