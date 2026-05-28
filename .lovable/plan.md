## Objetivo

Fluxo de aprovação para reagendar R1 em lead já pago: SDR/Closer **solicita**, admin/manager/coordenador/Jessica **aprovam**. A R1 aprovada se comporta como um **reagendamento normal** — entra em todas as métricas (KPI Agendamentos, Team Meetings, no-show cap) sem flags especiais.

## Fluxo

```text
SDR/Closer tenta agendar R1 em lead pago
      │
      └─► guard deal_already_paid bloqueia
            │
            └─► UI mostra "Solicitar liberação"
                  │
                  ├─ SDR preenche: closer, data/hora, duração, motivo
                  └─ INSERT em r1_force_schedule_request (status=pending)
                        │
                        └─► Aprovador abre /crm/liberacoes-r1
                              ├─ Aprovar → chama calendly-create-event com forceFromRequestId
                              │            → cria R1 (= reagendamento normal) + request=approved
                              └─ Rejeitar → request=rejected + motivo
```

## Mudanças

### 1. Migration — tabela de solicitações
`r1_force_schedule_request`:
- `deal_id`, `requested_by`, `requested_closer_id`, `requested_scheduled_at`, `requested_duration_minutes`, `lead_type`, `notes`, `reason text`
- `status` enum: `pending | approved | rejected | cancelled`
- `reviewed_by`, `reviewed_at`, `review_notes`, `created_attendee_id`
- GRANT + RLS:
  - SDR/Closer: `INSERT` próprio + `SELECT` os próprios.
  - admin/manager/coordenador + Jessica (allowlist por email): `SELECT` todos + `UPDATE` status.
  - service_role total.

### 2. Edge function `calendly-create-event`
- Novo param: `forceFromRequestId?: string`.
- Quando presente:
  1. Valida JWT.
  2. Carrega request, exige `pending`.
  3. Autoriza aprovador (roles admin/manager/coordenador ou email allowlist). Senão `unauthorized_approver`.
  4. **Pula só** `deal_already_won` e `deal_already_paid`. Mantém `duplicate_active_booking`.
  5. Cria R1 com dados do request **pelo caminho normal de reagendamento** — sem flags extras no attendee. Conta em todas as métricas.
  6. Atualiza request → `approved`, grava `reviewed_by/at`, `created_attendee_id`.
  7. Registra `deal_activities` tipo `r1_force_approved` com referência ao aprovador (auditoria, não usado em métricas).
- SDR/Closer **sem** `forceFromRequestId` em lead pago continua bloqueado.

### 3. Edge function `r1-request-review` (nova)
- `POST { requestId, action: 'reject', notes }` → autoriza aprovador, marca `rejected`.
- (Aprovação não passa aqui — vai direto via `calendly-create-event` para criar R1 atomicamente.)

### 4. Helper de permissão
`src/lib/canApproveR1Request.ts`:
```ts
export const R1_APPROVER_EMAIL_ALLOWLIST = ['jessica.bellini@minhacasafinanciada.com'];
export function canApproveR1Request(role, allRoles, email) { ... }
```
Regra: roles `admin | manager | coordenador` OU email na allowlist.

### 5. Hook `useCalendlyIntegration.ts`
- `BookMeetingWithCalendlyParams` ganha `forceFromRequestId?: string`.
- Propaga `error.code` no throw para a UI diferenciar `deal_already_paid`/`deal_already_won`/`unauthorized_approver`.

### 6. Hooks novos
- `useCreateR1ForceRequest()` — INSERT no request.
- `useR1ForceRequests({ status, dealId? })` — lista (aprovador vê todos; solicitante vê os próprios).
- `useApproveR1Request()` — invoca `calendly-create-event` com `forceFromRequestId`.
- `useRejectR1Request()` — invoca `r1-request-review`.

### 7. UI — solicitante (SDR/Closer)
- `RequestR1ApprovalDialog` (Dialog) com:
  - Resumo do deal.
  - Inputs pré-preenchidos com o que ele tentou: closer, data/hora, duração, lead type, notes.
  - Textarea **obrigatória** "Motivo" (mín. 10 chars).
  - Botão "Enviar solicitação".
- No consumidor de `useBookMeetingWithCalendly`: em `onError` com `error.code ∈ {deal_already_paid, deal_already_won}` → abrir esse dialog.
- `R1ApprovalBanner` no card/drawer do deal: mostra status (`pendente` / `aprovada` / `rejeitada`) via `useR1ForceRequests` filtrado por `deal_id`.

### 8. UI — aprovador
- Nova rota `/{bu}/crm/liberacoes-r1` protegida por `canApproveR1Request`.
- Lista pendentes: deal, solicitante, closer/horário pedidos, motivo, ações **Aprovar** / **Rejeitar**.
- **Rejeitar**: AlertDialog com textarea de motivo (mín. 10 chars).
- **Aprovar**: AlertDialog de confirmação simples.
- Badge na sidebar com contagem de pendentes (poll a cada 30s).
- Tab "Histórico" — aprovadas/rejeitadas dos últimos 90 dias.

### 9. Memória do projeto
`mem/business-logic/r1-approval-flow-policy.md`:
- SDR/Closer solicita; aprovadores: admin/manager/coordenador + Jessica (email allowlist).
- Aprovação cria R1 via `calendly-create-event` com `forceFromRequestId`, comportando-se **como reagendamento normal** (entra em KPI Agendamentos, no-show cap, Team Meetings, atribuição SDR via `booked_by = requested_by`).
- Mantém guard `duplicate_active_booking`.
- Não altera attendees/transações/payouts/métricas históricas. Não rebaixa stage do deal.
- Nova venda do sócio após a nova R1: link Hubla **manual** para evitar colisão com contrato original.

## Garantias
- **Sem mudança em dados históricos.**
- **R2 não é tocado** (não tem guard).
- **`duplicate_active_booking` continua ativo.**
- **R1 aprovada = reagendamento normal**: sem flag, sem isolamento, conta em tudo.
- **Stage do deal não muda** (permanece "Contrato Pago"), então cross-pipeline replication não dispara de novo.

## Arquivos
- Migration (nova) — tabela + enum + GRANTs + RLS
- `supabase/functions/calendly-create-event/index.ts` — suporte a `forceFromRequestId`
- `supabase/functions/r1-request-review/index.ts` (nova)
- `src/lib/canApproveR1Request.ts` (novo)
- `src/hooks/useCalendlyIntegration.ts` — novo param + propagar error code
- `src/hooks/useR1ForceRequests.ts` (novo)
- `src/components/crm/RequestR1ApprovalDialog.tsx` (novo)
- `src/components/crm/R1ApprovalBanner.tsx` (novo)
- `src/pages/crm/LiberacoesR1.tsx` (nova)
- Sidebar — badge de pendentes
- Roteamento CRM — registrar rota
- Consumidor de `useBookMeetingWithCalendly` — abrir dialog no erro
- `mem/business-logic/r1-approval-flow-policy.md` (novo)

## Fora de escopo
- Notificação por e-mail/WhatsApp (só badge + lista).
- Edição da solicitação após envio (solicitante só pode cancelar).
- Mudanças em métricas/relatórios.
