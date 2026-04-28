---
name: Process Rules Engine
description: Sistema centralizado de regras configuráveis (limites SDR/Closer, aprovação de reagendamento) por BU + cargo, com fluxo de aprovação no app.
type: feature
---
**Tabelas**:
- `process_rules` (bu, role sdr|closer, rule_key, rule_value jsonb, is_active) — BU=null = global; BU-specific override.
- `rule_approval_requests` (status pending/approved/rejected/cancelled, requester_role, target_deal_id, payload).

**Função SQL**: `get_process_rule(_bu, _role, _rule_key) → jsonb` resolve a regra efetiva (BU-specific > global).

**rule_keys padrão**:
- `max_meetings_per_week` ({value: number|null}) — substitui hardcoded 2.
- `max_noshows_counted` ({value: number|null}) — substitui hardcoded 2.
- `reschedule_approval_threshold` ({value: number|null}) — null = desativado.
- `approval_required_roles` ({roles: ["admin","coordenador","manager"]}).

**Hooks**:
- `useAllProcessRules`, `useEffectiveRule(bu,role,key)`, `useUpsertProcessRule`.
- `usePendingApprovals`, `usePendingApprovalsCount` (badge sidebar), `useApprovalHistory`, `useMyApprovalRequests`, `useCreateApprovalRequest`, `useReviewApprovalRequest`.

**Página**: `/admin/regras-processo` — abas Regras (matriz BU×SDR/Closer), Pendentes, Histórico. Acesso: admin/manager/coordenador.

**Aprovadores**: admin, coordenador, manager (não existe `supervisor` no enum app_role do projeto).

**Próxima integração**: refatorar `useAgendaData.ts` (linha ~1078, totalMovements >= 2) para consultar `reschedule_approval_threshold` e abrir fluxo de aprovação em vez do warning fixo.
