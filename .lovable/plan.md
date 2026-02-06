
# Automacao Cross-Pipeline: Falta Cron Job para Processamento Automatico

## Diagnostico

O sistema de replicacao cross-pipeline **esta parcialmente funcionando**, mas falta a automacao final:

| Componente | Status | Descricao |
|------------|--------|-----------|
| Trigger (adicionar na fila) | Funcionando | Quando deal muda de stage, insere em `deal_replication_queue` |
| Edge Function | Funcionando | `process-deal-replication` processa corretamente |
| Cron Job | **NAO EXISTE** | Nada esta chamando a Edge Function automaticamente |

## Evidencias

### 1. Trigger funcionando (insere na fila)
```sql
-- Trigger exists and is active
CREATE TRIGGER trigger_deal_replication
AFTER UPDATE OF stage_id ON public.crm_deals
FOR EACH ROW
EXECUTE FUNCTION public.notify_deal_replication();
```

### 2. Fila com items processados (via botao manual)
```
deal_id: fe15e90d-a231-467f-b625-860bb265ec38
status: processed
processed_at: 2026-02-06 19:03:29
```

### 3. Logs da Edge Function (processou ao clicar "Processar Fila")
```
2026-02-06T19:03:29Z - Created replica: bdd41174... via rule Parceria - GR
2026-02-06T19:03:29Z - Created replica: ac0b3d81... via rule Parceria -> Consorcio
```

### 4. Cron Jobs existentes (nenhum para replicacao)
```text
sync-contacts-cron           */5 * * * *   (a cada 5 min)
sync-deals-cron              */10 * * * *  (a cada 10 min)
sync-clint-full-auto         */10 * * * *  (a cada 10 min)
process-csv-imports          */2 * * * *   (a cada 2 min)
auto-close-weekly-metrics    30 3 * * 6    (sabado 3:30)
detect-ghost-hourly          0 * * * *     (todo hora)
sync-newsale-orphans-daily   0 6 * * *     (todo dia 6h)
detect-duplicates-daily      0 3 * * *     (todo dia 3h)
reprocess-failed-webhooks    */15 * * * *  (a cada 15 min)
```

**Nao existe `process-deal-replication-cron`!**

## Solucao

Criar uma migracao SQL para adicionar o cron job que chama a Edge Function `process-deal-replication` automaticamente:

### Migracao SQL

```sql
-- Adicionar cron job para processar fila de replicacao cross-pipeline
-- Executa a cada 2 minutos para garantir processamento rapido

SELECT cron.schedule(
  'process-deal-replication-cron',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/process-deal-replication',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE'
    ),
    body := '{"process_queue": true}'::jsonb
  ) AS request_id;
  $$
);
```

## Fluxo Apos Correcao

```text
ANTES (atual):
Deal muda stage → Trigger → Fila → [NADA] → Usuario clica "Processar Fila" → Edge Function

DEPOIS (corrigido):
Deal muda stage → Trigger → Fila → Cron (2min) → Edge Function → Replica criada automaticamente
```

## Arquivos a Criar/Modificar

| Arquivo | Alteracao |
|---------|-----------|
| Nova migracao SQL | Adicionar cron job `process-deal-replication-cron` |

## Resultado Esperado

- Deals que chegam ao stage "Venda Realizada" serao automaticamente replicados
- Processamento maximo em 2 minutos apos a mudanca de stage
- Sem necessidade de clicar manualmente em "Processar Fila"
- Logs continuam funcionando para monitoramento

## Frequencia Recomendada

| Frequencia | Pros | Contras |
|------------|------|---------|
| `*/1 * * * *` (1 min) | Mais rapido | Mais chamadas |
| `*/2 * * * *` (2 min) | Equilibrado | Delay aceitavel |
| `*/5 * * * *` (5 min) | Menos chamadas | Delay maior |

Recomendo **2 minutos** como equilibrio entre velocidade e eficiencia, seguindo o padrao do `process-csv-imports`.
