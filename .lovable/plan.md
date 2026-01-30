
# Plano: Corrigir Reembolso para Afetar Apenas o Attendee Individual

## Problema Identificado

Você está correto! Quando um reembolso é processado no R2:

| Comportamento Atual | Comportamento Correto |
|--------------------|----------------------|
| Atualiza `meeting_slots.status` → "refunded" | NÃO deve alterar o slot |
| Atualiza TODOS `meeting_slot_attendees.status` → "refunded" | Deve atualizar APENAS o attendee específico |

### Causas no Código

1. **R2MeetingDetailDrawer.tsx (linha 408)**: Não passa o `attendeeId` para o `RefundModal`, mesmo tendo acesso a `attendee.id`

2. **RefundModal.tsx (linhas 95-101)**: Para R2, chama `useUpdateR2MeetingStatus` que atualiza o slot inteiro

3. **useR2AgendaData.ts (linhas 37-42)**: O hook `useUpdateR2MeetingStatus` propaga o status para TODOS os attendees do slot

---

## Solução Proposta

### Etapa 1: Passar attendeeId para o RefundModal

No `R2MeetingDetailDrawer.tsx`, adicionar a prop `attendeeId`:

```typescript
<RefundModal
  open={refundModalOpen}
  onOpenChange={setRefundModalOpen}
  meetingId={meeting.id}
  attendeeId={attendee.id}  // ← ADICIONAR
  dealId={attendee.deal_id}
  ...
/>
```

### Etapa 2: Atualizar RefundModal para R2

No `RefundModal.tsx`, para R2 com `attendeeId`, atualizar apenas o attendee individual (similar ao R1):

```typescript
} else {
  // For R2: update individual attendee, NOT the slot
  if (attendeeId) {
    // 1. Update attendee status to 'refunded'
    await supabase
      .from('meeting_slot_attendees')
      .update({ status: 'refunded' })
      .eq('id', attendeeId);
    
    // 2. Update r2_status_id to "Reembolso"
    const { data: reembolsoStatus } = await supabase
      .from('r2_status_options')
      .select('id')
      .ilike('name', '%reembolso%')
      .single();
    
    if (reembolsoStatus?.id) {
      await supabase
        .from('meeting_slot_attendees')
        .update({ r2_status_id: reembolsoStatus.id })
        .eq('id', attendeeId);
    }
  }
}
```

### Etapa 3: Adicionar invalidações do Carrinho

```typescript
queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
queryClient.invalidateQueries({ queryKey: ['r2-fora-carrinho-data'] });
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/crm/R2MeetingDetailDrawer.tsx` | Adicionar `attendeeId={attendee.id}` ao RefundModal |
| `src/components/crm/RefundModal.tsx` | Para R2: atualizar apenas o attendee individual + r2_status_id + invalidar queries do carrinho |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| R2 com 2 attendees, 1 pede reembolso | Slot inteiro fica "refunded", afeta ambos | Apenas o attendee específico fica "refunded" |
| KPI de Aprovados | Não atualiza | Diminui em 1 (por causa do r2_status_id) |
| KPI Fora do Carrinho | Não atualiza | Aumenta em 1 |
| Outros attendees do mesmo slot | São afetados | Não são afetados |

---

## Fluxo Corrigido

```text
1. Usuário seleciona um attendee no drawer R2
2. Clica "Reembolso"
3. Preenche motivo e justificativa
4. Sistema executa:
   a) meeting_slot_attendees.status → "refunded" (APENAS o attendee selecionado)
   b) meeting_slot_attendees.r2_status_id → ID do status "Reembolso"
   c) crm_deals.custom_fields → flags de reembolso
   d) Invalida queries do carrinho
5. Slot e outros attendees NÃO são afetados
6. KPIs são recalculados automaticamente
```
