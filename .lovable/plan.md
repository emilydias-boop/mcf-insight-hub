

## Plano: Drawer de detalhes ao clicar na linha da auditoria

### O que muda

Ao clicar em uma linha na tabela de auditoria, abre um **Sheet/Drawer** lateral com:

1. **Motivo da classificação** — texto explicando por que a mudança é suspeita ou manual (ex: "No-show → Realizada: reversão de status final", "Agendado → No-show: mudança manual fora do fluxo automático")
2. **Dados do Lead** — nome, telefone, deal_id, contact_id (extraídos do `old_data`/`new_data` do audit_log)
3. **Dados da Reunião** — tipo (R1/R2), data agendada, closer, link da reunião
4. **Observações/Notas** — campo `notes` do attendee, `r2_observations`, `closer_notes`
5. **Histórico completo** — todas as mudanças do mesmo attendee (usando `useR2AuditHistory` existente), com diff legível via `getAuditDiff`
6. **Todas as alterações do registro** — diff completo entre old_data e new_data da mudança selecionada

### Alterações por arquivo

| Arquivo | Ação |
|---------|------|
| `src/hooks/useStatusChangeAudit.ts` | Expandir `StatusChangeEntry` com novos campos: `attendee_id`, `attendee_phone`, `deal_id`, `contact_id`, `notes`, `r2_observations`, `closer_notes`, `meeting_link`, `is_reschedule` (extraídos de `old_data`/`new_data`). Adicionar `suspension_reason` string calculada |
| `src/components/audit/StatusChangeDetailDrawer.tsx` | **Novo arquivo**. Sheet lateral com seções: Motivo, Lead, Reunião, Observações, Histórico do attendee (reusa `useR2AuditHistory` + `getAuditDiff`) |
| `src/components/audit/StatusChangesTab.tsx` | Adicionar state `selectedEntry`, tornar linhas clicáveis (`cursor-pointer`), renderizar o drawer |

### Lógica do "Motivo"

Mapeamento estático de cada transição suspeita para uma descrição em português:
- `no_show → completed`: "Reversão: lead marcado como No-show foi alterado para Realizada"
- `completed → no_show`: "Status final alterado: reunião realizada revertida para No-show"
- `cancelled → completed`: "Reversão de cancelamento para Realizada"
- etc.

Para mudanças não-suspeitas mas manuais: "Mudança manual fora do fluxo automático padrão"

### Dados do Lead no Drawer

Os campos já existem no `old_data`/`new_data` do audit_log:
- `attendee_name`, `attendee_phone`, `deal_id`, `contact_id`
- `notes`, `r2_observations`, `closer_notes`, `meeting_link`
- `is_reschedule`, `video_status`, `lead_profile`

Não precisa de query extra — basta extrair do JSON que já é carregado.

