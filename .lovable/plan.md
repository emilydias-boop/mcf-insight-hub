
# Corrigir No-Shows que Aparecem Mesmo Após Reembolso

## Problema Identificado

**Caso concreto: Diéssi Borba**

A lead Diéssi aparece na lista de No-Shows mesmo após ter solicitado reembolso. Isso ocorre porque:

1. Ela foi marcada como **"No-show"** primeiro → `meeting_slot_attendees.status = 'no_show'`
2. Depois, clicaram em **"Reembolso"** no drawer → `meeting_slots.status = 'refunded'`
3. **Porém**, o `RefundModal` usa `useUpdateR2MeetingStatus`, que **não atualiza** o `meeting_slot_attendees.status`

### Diferença nos Fluxos

| Ação | Hook Usado | Atualiza Attendee? |
|------|------------|-------------------|
| "Realizada" / "No-show" | `useUpdateAttendeeAndSlotStatus` | Sim |
| "Reembolso" | `useUpdateR2MeetingStatus` | Não (só meeting) |

### Resultado

A query de No-Shows busca `meeting_slot_attendees.status = 'no_show'`, então a Diéssi continua aparecendo mesmo que o meeting esteja como `refunded`.

---

## Solução em Duas Partes

### Parte 1: Corrigir `useUpdateR2MeetingStatus` para Atualizar Attendees

**Arquivo:** `src/hooks/useR2AgendaData.ts`

Adicionar atualização de todos os attendees do meeting para o mesmo status (especialmente para `refunded`):

```text
// Após atualizar meeting_slots.status (linha 33)
// Adicionar: Atualizar status de todos os attendees deste meeting
await supabase
  .from('meeting_slot_attendees')
  .update({ status })
  .eq('meeting_slot_id', meetingId);
```

**Motivo:** Quando um meeting inteiro é marcado como `refunded`, faz sentido que todos os participantes também tenham esse status.

### Parte 2: Adicionar Filtro de Segurança na Query de No-Shows

**Arquivo:** `src/hooks/useR2NoShowLeads.ts`

Adicionar verificação para excluir attendees cujo deal tenha `reembolso_solicitado = true`:

Na transformação dos leads (após linha 242), adicionar:

```text
// Skip if deal has reembolso_solicitado flag
const customFields = att.deal?.custom_fields as Record<string, unknown> | null;
if (customFields?.reembolso_solicitado === true) {
  return;
}
```

E no contador (`useR2NoShowsCount`), fazer verificação similar buscando os deal_ids e filtrando aqueles com flag de reembolso.

---

## Mudanças Detalhadas

### 1. `src/hooks/useR2AgendaData.ts` - `useUpdateR2MeetingStatus`

**Adicionar após linha 33 (após atualizar meeting_slots):**

```typescript
// 1.5 Update all attendees of this meeting to the same status
await supabase
  .from('meeting_slot_attendees')
  .update({ status })
  .eq('meeting_slot_id', meetingId);
```

### 2. `src/hooks/useR2NoShowLeads.ts` - `useR2NoShowLeads`

**Modificar a transformação de attendees (linha 242) para verificar flag de reembolso:**

Adicionar condição:

```typescript
// Skip if deal has reembolso_solicitado flag  
const customFields = att.deal?.custom_fields as Record<string, unknown> | null;
if (customFields?.reembolso_solicitado === true) {
  return;
}
```

### 3. `src/hooks/useR2NoShowLeads.ts` - `useR2NoShowsCount`

**Adicionar busca de deals com reembolso para subtrair do contador:**

```typescript
// Step 2.5: Get deal_ids of no-shows and check for refunded deals
const { data: noShowDeals } = await supabase
  .from('meeting_slot_attendees')
  .select('id, deal_id')
  .in('id', noShowIds);

// Filter out those with reembolso_solicitado
const dealIdsToCheck = noShowDeals?.filter(a => a.deal_id).map(a => a.deal_id as string) || [];
let refundedDealIds = new Set<string>();
if (dealIdsToCheck.length > 0) {
  const { data: refundedDeals } = await supabase
    .from('crm_deals')
    .select('id, custom_fields')
    .in('id', dealIdsToCheck);
  
  refundedDealIds = new Set(
    refundedDeals?.filter(d => (d.custom_fields as any)?.reembolso_solicitado === true).map(d => d.id) || []
  );
}

// Map no-show IDs to their deal_ids for filtering
const noShowsWithRefundedDeals = new Set(
  noShowDeals?.filter(a => a.deal_id && refundedDealIds.has(a.deal_id)).map(a => a.id) || []
);

// Step 3: Count = total - rescheduled - refunded_deals
return noShowIds.length - rescheduledParentIds.size - noShowsWithRefundedDeals.size;
```

---

## Resultado Esperado

| Situação | Antes | Depois |
|----------|-------|--------|
| No-show → Reembolso | Continua em No-Shows | Sai de No-Shows imediatamente |
| Contador de No-Shows | Conta leads reembolsados | Não conta leads reembolsados |
| Dados antigos (Diéssi) | Aparece na lista | Não aparece (filtro por flag) |

---

## Arquivos a Modificar

1. `src/hooks/useR2AgendaData.ts` - Atualizar attendees junto com meeting
2. `src/hooks/useR2NoShowLeads.ts` - Filtrar leads com flag de reembolso (lista e contador)

---

## Nota sobre Retroatividade

- **Parte 1** corrige novos reembolsos (atualiza attendee automaticamente)
- **Parte 2** corrige dados históricos (exclui por flag no deal)

Juntas, as duas partes garantem que nenhum lead reembolsado apareça em No-Shows.
