# Diagnóstico — trava "CONTRATO JÁ PAGO" no modal Agendar Reunião

## 1. Onde está o bloco verde

`src/components/crm/BlockedLeadCard.tsx:57-67` — texto literal:

```tsx
} else {
  // contract_paid | won
  title = 'CONTRATO JÁ PAGO';
  icon = <Trophy className="h-6 w-6" />;
  description = 'Lead concluído — venda fechada.';
  helper = 'Não é necessário (nem permitido) agendar nova reunião.';
  containerCls = 'border-green-500/60 bg-green-500/10 dark:bg-green-500/5';
```

Consumido em `src/components/crm/QuickScheduleModal.tsx:1392-1400` (R1) e também em `src/components/crm/R2QuickScheduleModal.tsx`.

## 2. Condição exata que dispara o bloqueio (front)

`src/components/crm/QuickScheduleModal.tsx:564-577`:

```tsx
const blockedLeadState = useMemo<'scheduled_future' | 'contract_paid' | 'won' | null>(() => {
  const state = selectedDeal?.leadState;
  if (state === 'scheduled_future' || state === 'contract_paid' || state === 'won') {
    return state as 'scheduled_future' | 'contract_paid' | 'won';
  }
  return null;
}, [selectedDeal?.leadState]);
const isLeadBlocked = blockedLeadState !== null;
```

O `leadState` é calculado em `src/hooks/useAgendaData.ts:1172-1189`:

```ts
// 1) Contrato pago tem prioridade absoluta
const hasContractPaid = atts.some(
  (a: any) => a.status === 'contract_paid' || a.contract_paid_at,
);
const isConsorcio = bu === 'consorcio';
if (hasContractPaid && meetingType !== 'r2' && !isConsorcio) {
  leadState = 'contract_paid';
  blockReason = 'Lead já tem contrato pago — não é possível agendar nova reunião.';
} else if (dealStatus === 'won' && meetingType !== 'r2' && !isConsorcio) {
  leadState = 'won';
  blockReason = 'Lead já fechou contrato — não é possível agendar nova reunião.';
}
```

Ou seja: olha **os dois** — `meeting_slot_attendees.status = 'contract_paid'` **OU** `contract_paid_at IS NOT NULL` (qualquer attendee histórico não-cancelado do deal). O caminho `won` é derivado do **nome da etapa** do deal, via `getDealStatusFromStage` (`src/lib/dealStatusHelper.ts:9-34`, palavras-chave "contrato pago", "venda realizada", "fechado", etc.). Exceções embutidas: `meetingType === 'r2'` e `bu === 'consorcio'` não bloqueiam.

## 3. De onde vem o dado

`useSearchDealsForSchedule` em `src/hooks/useAgendaData.ts` (usado no modal em `QuickScheduleModal.tsx:277`). Busca deals por nome/contato (`crm_deals` + `crm_contacts` + `crm_stages`) e, em `useAgendaData.ts:1136-1144`, carrega o histórico de participantes:

```ts
const { data: allAttendees } = await supabase
  .from('meeting_slot_attendees')
  .select(`id, deal_id, status, contract_paid_at, created_at, booked_at,
     meeting_slot:meeting_slots(id, scheduled_at, meeting_type, status, closer:closers(name))`)
  .in('deal_id', dealIds)
  .neq('status', 'cancelled')
  .order('created_at', { ascending: false });
```

## 4. A trava é só de front? — NÃO, mas também não é do banco

Há **dois** níveis, e nenhum deles é do Postgres:

**(a) Edge function `calendly-create-event`** — é por onde o modal cria a reunião (`useCreateMeeting`). Guards em `supabase/functions/calendly-create-event/index.ts:552-607`:

```ts
if (guardMeetingType === 'r1' && !isConsorcioDeal && !isOutsideDeal) {
if (!approvedRequest) {
  // 1) stage "won"...
  if (isWonStage) { ... error: "deal_already_won" ... }

  // 2) Contrato pago (qualquer attendee histórico)
  const { data: paidAttendee } = await supabase
    .from("meeting_slot_attendees")
    .select("id")
    .eq("deal_id", dealId)
    .or("status.eq.contract_paid,contract_paid_at.not.is.null")
    .limit(1)
    .maybeSingle();

  if (paidAttendee) { ... error: "deal_already_paid" ... }
}
```

**(b) Banco: nenhuma barreira.** Verificado por consulta:

- Policies de `meeting_slot_attendees` / `meeting_slots`: o INSERT é `WITH CHECK (auth.uid() IS NOT NULL)` nas duas tabelas. Nada sobre contrato pago.
- Triggers de INSERT em `meeting_slot_attendees`: `trg_auto_move_contrato_pago`, `trg_checkin_autocreate_attendee`, `trg_notify_mcf_pay_on_contract_paid`, `trg_sync_deal_closer_email_from_attendee` — todos AFTER e de efeito colateral; nenhum valida/rejeita criação. Os validadores existentes (`enforce_meeting_status_lock`, `enforce_no_show_evidence`, `protect_contract_paid_at`, `prevent_no_show_after_same_day_move`) são todos **BEFORE UPDATE**.
- Check constraints: só `duration_minutes > 0`, `lead_type IN (A,B,C)` e a lista de `status` em `meeting_slots`. Nada de contrato pago. Nenhuma constraint UNIQUE relevante.

**Conclusão da pergunta mais importante:** contornando a tela, o banco **aceitaria** o insert. Um `INSERT` direto em `meeting_slots` + `meeting_slot_attendees` por qualquer usuário autenticado cria a reunião num deal com contrato pago sem erro. A única barreira efetiva além do front é a edge function — e ela só protege quem passa por ela.

Observação: existe um caminho de insert direto no próprio código do app — `useAddMeetingAttendee` em `src/hooks/useAgendaData.ts:1732-1745` insere em `meeting_slot_attendees` sem passar pela edge function (usado para adicionar sócio/participante a um slot existente). Esse caminho não checa contrato pago.

## 5. Caminho de exceção para admin — já existe

Fluxo completo `r1_force_paid_lead` (documentado em `mem/business-logic/r1-force-paid-lead-approval-flow.md`):

- Front: `QuickScheduleModal.tsx:480-505` captura `deal_already_paid` / `deal_already_won` / `deal_r1_cooldown_active` e abre o diálogo de pedido de liberação (`RequestR1ApprovalDialog`, motivo obrigatório).
- Persistência: `useCreateR1ForceRequest` grava em `rule_approval_requests` com `rule_key = 'r1_force_paid_lead'`.
- Aprovação: aba "Aprovações Pendentes" em `/admin/regras-processo`; aprovadores validados pela função SECURITY DEFINER `public.is_r1_force_approver(uuid)` (admin, manager, coordenador ou Jessica Bellini).
- Bypass: a aprovação reinvoca `calendly-create-event` com `forceFromRequestId`; ver `index.ts:343-395` (valida JWT + RPC) e `index.ts:552-608` (`if (!approvedRequest)` envolve só os guards 1 e 2). O guard 3 `duplicate_active_booking` permanece ativo.

Exceções automáticas, sem aprovação: `bu === 'consorcio'` (`index.ts:539-541`) e deal com tag `outside` (`index.ts:523-525, 542-544`), além de todo `meeting_type = 'r2'`.

## 6. Reunião que ocupa agenda mas não entra na apuração

O único campo com esse papel é `meeting_slot_attendees.is_partner` (boolean). Não existem colunas `excluded`, `ignorar`, `interna`, `fora_funil` em `meeting_slots` nem em `meeting_slot_attendees` (verificado em `information_schema.columns`); o que existe é `is_partner` e `partner_name`.

O que ele faz de fato: marca o participante como **acompanhante/sócio** do lead principal (criado com `parent_attendee_id`, herdando o `deal_id` do pai — `useAgendaData.ts:1716-1743`). O registro ocupa lugar no slot (entra na contagem de capacidade `max_leads`, `useAgendaData.ts:1708-1712`) e é filtrado fora de praticamente toda apuração:

- `.eq('is_partner', false)` em `useSdrContractsFromAgenda.ts:73`, `useCloserGamificationRuntime.ts:83,93`, `useSdrOutsideMetrics.ts:157`, `external-query/index.ts:305,324`, `webhook-make-contrato/index.ts:82`, `hubla-webhook-handler/index.ts:1561`.
- Filtro em memória `!a.is_partner` em `src/pages/crm/Agenda.tsx:182,210,224,365`, `useCloserContractsList.ts:83`, `useCarrinhoAnalysisReport.ts:969`, `InvestigationReportPanel.tsx:121,181`, `weekly-manager-report/index.ts:326,403`.
- Automação: `automation-event-dispatcher/index.ts:154` e `send-meeting-notification/index.ts:169` usam `is_partner` para não disparar mensagem ao acompanhante.

Não existe, portanto, um conceito de "reunião interna / cortesia" no nível do **slot**. A única exclusão de apuração é por participante, e ela significa "sócio/acompanhante", não "não conta". Reuniões só saem da apuração por `status = 'cancelled'` ou por `meeting_type`.
