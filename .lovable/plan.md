## Objetivo

Substituir o envio automático silencioso por um fluxo explícito: quando o SDR/Closer tenta agendar R1 em lead já pago/won, abrir um dialog "Solicitar liberação" com motivo obrigatório, em vez de só mostrar toast de erro.

## Fluxo novo

```text
SDR clica Agendar → QuickScheduleModal → confirma
      │
      ├─ Sucesso normal → toast verde, fecha modal
      └─ Erro deal_already_paid / deal_already_won
            │
            ├─ NÃO cria pedido automaticamente
            ├─ Toast informativo amarelo: "Lead com contrato pago — solicite liberação"
            └─ Abre RequestR1ApprovalDialog
                  ├─ Mostra: deal, closer escolhido, data/hora, duração, tipo
                  ├─ Campo obrigatório: Motivo (textarea, mín. 10 chars)
                  ├─ Botão "Enviar solicitação" → INSERT em rule_approval_requests (rule_key=r1_force_paid_lead)
                  ├─ Toast verde: "Solicitação enviada para admin/manager/coordenador/Jessica"
                  └─ Fecha modal de agendamento também
```

Aprovação continua igual ao já implementado: aprovador entra em `/admin/regras-processo` → aba "Aprovações Pendentes" → aprovar invoca `calendly-create-event` com `forceFromRequestId`. Sem mudança no backend.

## Mudanças

### 1. Remover auto-criação silenciosa em `useAgendaData.ts`
Bloco linhas ~1425–1492 (`useCreateMeeting`): no caso `deal_already_paid`/`deal_already_won`, **não** inserir mais em `rule_approval_requests`. Apenas propagar o erro com `code` estruturado no objeto Error para a UI consumir:
```ts
const err: any = new Error(data.message || 'Lead com contrato pago');
err.code = data.error; // 'deal_already_paid' | 'deal_already_won'
err.payload = { closerId, dealId, contactId, scheduledAt, durationMinutes, notes, leadType, sdrEmail, alreadyBuilds, parentAttendeeId, bookedAt };
throw err;
```
Ajustar `onError` global do hook para **não** disparar `toast.error` quando `error.code` for um desses dois (a UI vai tratar).

### 2. Novo componente `src/components/crm/RequestR1ApprovalDialog.tsx`
Props:
- `open`, `onOpenChange`
- `dealId`, `dealName`, `contactName`
- `prefilledPayload` (todo o payload necessário pra recriar a R1)
- `onSubmitted?: () => void`

Conteúdo:
- Header com warning amarelo: "Este lead já tem contrato pago. Sua solicitação será enviada para liberação."
- Resumo do agendamento solicitado (closer, data/hora, duração, tipo).
- Textarea **obrigatória** "Motivo da solicitação" (mín. 10 chars), com contador.
- Botões: "Cancelar" / "Enviar solicitação".

Ao enviar:
1. Detecta BU do deal (mesma lógica atual via `crm_deals.origin_id` → `bu_origin_mapping`).
2. Verifica se já existe pedido pendente desse usuário/deal (evita duplicar).
3. INSERT em `rule_approval_requests` com `rule_key='r1_force_paid_lead'`, `payload` contendo o `prefilledPayload` + `block_reason` + `reason` (motivo do SDR).
4. Invalida queries `my-approval-requests`, `approval-requests-pending`, `approval-requests-pending-count`.
5. Toast verde + `onSubmitted()`.

### 3. Novo hook `src/hooks/useCreateR1ForceRequest.ts`
Encapsula a lógica de detecção de BU + dedup + INSERT. Usado pelo dialog.

### 4. Atualizar `QuickScheduleModal.tsx`
- Importar `RequestR1ApprovalDialog`.
- Estado local `r1ApprovalContext: { payload, dealName, contactName } | null`.
- No `createMeeting.mutate({...}, { onError: (error) => { ... } })`:
  ```ts
  if (error?.code === 'deal_already_paid' || error?.code === 'deal_already_won') {
    toast.warning('Lead já tem contrato pago — solicite liberação para agendar');
    setR1ApprovalContext({
      payload: error.payload,
      dealName: selectedDeal?.name,
      contactName: selectedDeal?.contact?.name,
    });
  }
  ```
- Renderizar `<RequestR1ApprovalDialog>` quando `r1ApprovalContext` existir. No `onSubmitted`, fechar tanto o dialog quanto o `QuickScheduleModal`.

### 5. (Opcional, mesmo padrão) `R2QuickScheduleModal.tsx`
Não tem guard de paid no R2 hoje, então **não mexer**.

### 6. Banner de status no DealDetailsDrawer (escopo mínimo)
Adicionar `R1ApprovalStatusBadge` simples no drawer do deal quando houver pedido pendente/rejeitado:
- Pendente: badge amarelo "Solicitação de liberação R1 pendente"
- Rejeitada: badge vermelho "Última solicitação rejeitada" + motivo.
Sem novo componente complexo — só leitura de `rule_approval_requests` filtrada por `target_deal_id` e `rule_key='r1_force_paid_lead'`, ordenada por `created_at desc limit 1`.

### 7. Atualizar memória
`mem/business-logic/r1-force-paid-lead-approval-flow.md`: trocar "auto-cria via useCreateMeeting" por "SDR/Closer envia explicitamente via RequestR1ApprovalDialog com motivo obrigatório".

## Garantias
- **Backend inalterado** (`calendly-create-event`, RLS, função `is_r1_force_approver`, aba de aprovação) — só remove a auto-criação silenciosa do frontend.
- **R2 não tocado**.
- Aprovação continua se comportando como reagendamento normal (KPIs, no-show cap, atribuição SDR).
- Sem duplicação: dialog checa pedido pendente existente antes de inserir.

## Arquivos
- `src/hooks/useAgendaData.ts` — remover auto-INSERT, propagar `error.code`+`payload`, silenciar toast global pro caso
- `src/hooks/useCreateR1ForceRequest.ts` (novo)
- `src/components/crm/RequestR1ApprovalDialog.tsx` (novo)
- `src/components/crm/QuickScheduleModal.tsx` — tratar `onError`, abrir dialog
- `src/components/crm/DealDetailsDrawer.tsx` — badge de status (opcional, pequeno)
- `mem/business-logic/r1-force-paid-lead-approval-flow.md` — atualizar descrição do fluxo

## Fora de escopo
- Notificações email/WhatsApp.
- Página dedicada `/crm/liberacoes-r1` (aprovador já usa `/admin/regras-processo`).
- Edição/cancelamento do pedido pelo SDR (pode vir depois).
