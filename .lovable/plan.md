

# Deletar 123 deals recuperados pré-2026

## Resumo
Dos 182 deals com tag `recuperado-a010`, 123 são de compradores A010 de 2024/2025. Vamos deletar esses 123 deals e seus registros dependentes, mantendo apenas os 59 de 2026.

## Execução
Uma migration SQL que:
1. Identifica os 123 deal IDs (já levantados) cujo primeiro A010 foi antes de 2026-01-01
2. Deleta dependências: `deal_activities`, `deal_tasks`, `automation_queue`, `automation_logs`, `calls`, `meeting_slots` (e filhos), `consorcio_pending_registrations` (e `consortium_documents`)
3. Deleta os 123 deals de `crm_deals`

## Resultado
- 123 deals antigos removidos
- 59 deals de 2026 preservados na pipeline Inside Sales

| Arquivo | Acao |
|---|---|
| `supabase/migrations/*.sql` | DELETE dos 123 deals recuperados pré-2026 e dependências |

