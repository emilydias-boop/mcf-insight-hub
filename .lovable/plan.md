

# Limpar 3 deals duplicados do CSV

## Ação
Deletar os 3 deals com `data_source = 'csv'` que são cópias dos deals originais criados via webhook na pipeline Inside Sales.

### IDs a deletar
- `263113b4-1316-413f-a2bf-ff0a8bf97b70` (Diogo Cascudo - csv)
- `79663c2b-3810-4b32-98e0-2e42590f77ad` (Pedro Brandão - csv)
- `5dcce67b-e1d1-4e91-a58c-a0548e434132` (Régis Maciel - csv)

### Pré-limpeza
Antes de deletar cada deal, remover registros dependentes (deal_activities, deal_tasks, automation_queue, automation_logs, calls, meeting_slots e seus filhos).

### Execução
Uma migration SQL com DELETE cascata dos 3 IDs.

| Arquivo | Ação |
|---|---|
| `supabase/migrations/*.sql` | DELETE dos 3 deals CSV duplicados e seus registros dependentes |

