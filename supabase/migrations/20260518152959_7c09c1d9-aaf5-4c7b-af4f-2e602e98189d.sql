
-- 1) Cancelar itens pendentes de owner desligado
UPDATE public.automation_queue q
SET status = 'cancelled',
    error_message = 'Owner desligado — cancelado automaticamente',
    processed_at = now()
WHERE q.status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.crm_deals d
    JOIN public.employees e ON lower(e.email_pessoal) = lower(d.owner_id)
    WHERE d.id = q.deal_id
      AND e.status <> 'ativo'
  );

-- 2) Liberar a fila atual dos demais
UPDATE public.automation_queue
SET scheduled_at = now()
WHERE status = 'pending' AND scheduled_at > now();

-- 3) Função de cleanup defensivo
CREATE OR REPLACE FUNCTION public.cleanup_stuck_automation_queue()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.automation_queue q
  SET status = 'cancelled',
      error_message = COALESCE(error_message, '') || ' | cleanup: dono não resolvível ou desligado',
      processed_at = now()
  WHERE q.status = 'pending'
    AND q.created_at < now() - interval '24 hours'
    AND (
      EXISTS (
        SELECT 1 FROM public.crm_deals d
        JOIN public.employees e ON lower(e.email_pessoal) = lower(d.owner_id)
        WHERE d.id = q.deal_id AND e.status <> 'ativo'
      )
      OR EXISTS (
        SELECT 1 FROM public.crm_deals d
        JOIN public.employees e ON lower(e.email_pessoal) = lower(d.owner_id)
        WHERE d.id = q.deal_id
          AND (e.telefone IS NULL OR length(regexp_replace(e.telefone,'\D','','g')) < 10)
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.crm_deals d
        JOIN public.employees e ON lower(e.email_pessoal) = lower(d.owner_id)
        WHERE d.id = q.deal_id
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 4) Agendar cleanup diário às 04:00 UTC
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup_stuck_automation_queue_daily';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup_stuck_automation_queue_daily',
  '0 4 * * *',
  $$SELECT public.cleanup_stuck_automation_queue();$$
);
