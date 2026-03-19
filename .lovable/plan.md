

## Plano: Adicionar indicador "Closer vs SDR" na Auditoria

### Problema
A tabela de auditoria mostra quem alterou o status, mas não indica se essa pessoa é o closer da reunião ou outra pessoa (SDR/coordenador). Isso é essencial para detectar quando um SDR reverte um no_show que o closer marcou.

### Alterações

| Arquivo | Ação |
|---------|------|
| `src/hooks/useStatusChangeAudit.ts` | Buscar `employee_id` do closer, depois `profile_id` do employee, e comparar com `user_id` do log. Adicionar campo `changed_by_role: 'closer' \| 'sdr' \| 'outro'` e `is_external_change: boolean` ao `StatusChangeEntry` |
| `src/components/audit/StatusChangesTab.tsx` | Adicionar coluna "Cargo" na tabela mostrando badge colorido (verde = Closer, azul = SDR, cinza = Outro). Adicionar KPI card "Alterações por não-closer" no resumo. Highlight visual em vermelho quando `is_external_change && is_suspicious` |
| `src/components/audit/StatusChangeDetailDrawer.tsx` | Mostrar na seção "Metadados" se quem alterou é o closer ou não |

### Detalhes técnicos

**Resolução do cargo do alterador:**
1. O hook já busca `closers` e `profiles`. Adicionar busca de `employees.profile_id` via `closers.employee_id`
2. Para cada log: `closerProfileId = employeeMap[closer.employee_id]?.profile_id`
3. Se `log.user_id === closerProfileId` → "Closer". Senão, verificar se `user_id` está em `employees` com cargo de SDR → "SDR". Caso contrário → "Outro"

**Novo KPI card:** "Alterações não-closer" — conta entradas onde `is_external_change === true`, destacando quantas vezes alguém que não é o closer alterou o status.

**Coluna na tabela:** Entre "Alterado por" e "Data Reunião", adicionar coluna "Cargo" com badge:
- `Closer` (verde) — alteração feita pelo próprio closer
- `SDR` (azul) — alteração feita por SDR  
- `Outro` (cinza) — sistema ou outro perfil

