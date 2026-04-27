-- ============================================================
-- FASE A: Limpeza de logs antigos para liberar espaço e acelerar queries
-- Não toca em dados operacionais (contatos, deals, vendas, agenda)
-- ============================================================

-- 1) hubla_webhook_logs: deletar processados com mais de 90 dias
DELETE FROM public.hubla_webhook_logs
WHERE created_at < NOW() - INTERVAL '90 days'
  AND (status = 'processed' OR processed_at IS NOT NULL);

-- 2) webhook_events: deletar eventos antigos com mais de 90 dias
DELETE FROM public.webhook_events
WHERE created_at < NOW() - INTERVAL '90 days';

-- 3) sync_jobs: deletar jobs finalizados com mais de 30 dias
DELETE FROM public.sync_jobs
WHERE created_at < NOW() - INTERVAL '30 days'
  AND status IN ('completed', 'failed', 'success', 'done');

-- 4) alertas: deletar alertas antigos com mais de 90 dias
DELETE FROM public.alertas
WHERE created_at < NOW() - INTERVAL '90 days';

-- 5) deal_activities_duplicates: dropar tabela morta (lixo de migração)
DROP TABLE IF EXISTS public.deal_activities_duplicates;

-- 6) Reclaim de espaço (VACUUM regular — não bloqueia, devolve espaço gradualmente)
-- Nota: VACUUM FULL bloqueia tabela; o VACUUM normal é seguro em produção.
-- O autovacuum do Postgres fará o resto nas próximas horas.