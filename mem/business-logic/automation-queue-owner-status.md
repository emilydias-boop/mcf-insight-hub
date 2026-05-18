---
name: Automation Queue Owner Status
description: Fila de automação cancela itens cujo owner está com status != 'ativo' (desligado/inativo). Usa enum 'cancelled' (não 'skipped').
type: feature
---
- `automation_queue.status` é enum: pending/processing/sent/delivered/read/replied/failed/**cancelled**. Não existe 'skipped'.
- O `automation-processor` cancela itens quando o employee correspondente ao `crm_deals.owner_id` (match por `lower(email_pessoal)`) tem `status <> 'ativo'`.
- Função `cleanup_stuck_automation_queue()` roda diária via pg_cron (`cleanup_stuck_automation_queue_daily` às 04:00 UTC) e cancela itens pendentes >24h cujo dono está desligado, sem telefone (<10 dígitos) ou inexistente.