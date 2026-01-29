
# Plano: Corrigir Notas Aparecendo Erradas para Sócios

## Problema Identificado

João (sócio de Rafaela) está mostrando as notas de Antony porque:

1. **Ao criar o sócio**: O `deal_id` não é passado, resultando em `null` no banco
2. **Ao exibir no drawer**: O fallback `att.deal_id || activeMeeting.deal_id` usa o deal do meeting slot
3. **O meeting slot tem o deal do Antony** (primeiro participante ou outro contexto)
4. **As notas são buscadas por deal_id**, resultando nas notas erradas

| Campo | Valor Atual | Valor Correto |
|-------|-------------|---------------|
| João.deal_id | `null` | Igual ao da Rafaela |
| Fallback dealId | `activeMeeting.deal_id` (Antony) | `parentAttendee.deal_id` (Rafaela) |

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/crm/AgendaMeetingDrawer.tsx` | **Modificar** - Passar dealId do parent ao criar sócio + corrigir fallback |
| `src/hooks/useAgendaData.ts` | **Modificar** - Herdar deal_id do parent (além do booked_by) |

---

## Alterações

### 1. AgendaMeetingDrawer.tsx - handleAddPartner (linhas 397-403)

Passar o `dealId` do parent ao criar sócio:

```typescript
addAttendee.mutate({
  meetingSlotId: activeMeeting.id,
  dealId: selectedParticipant.dealId,  // ✅ NOVO: Herda deal do parent
  attendeeName: partnerName,
  attendeePhone: partnerPhone || undefined,
  isPartner: true,
  parentAttendeeId: selectedParticipant.id,
});
```

### 2. AgendaMeetingDrawer.tsx - getParticipantsList (linha 448)

Corrigir fallback para usar parent attendee antes do meeting slot:

```typescript
dealId: att.deal_id || parentAttendee?.deal_id || activeMeeting.deal_id,
```

### 3. useAgendaData.ts - useAddMeetingAttendee (linhas 1049-1059)

Herdar também o `deal_id` do parent quando não fornecido:

```typescript
// Se for sócio, herdar booked_by e deal_id do parent
let inheritedBookedBy: string | null = null;
let inheritedDealId: string | null = null;
if (parentAttendeeId) {
  const { data: parentData } = await supabase
    .from('meeting_slot_attendees')
    .select('booked_by, deal_id')  // ✅ Incluir deal_id
    .eq('id', parentAttendeeId)
    .maybeSingle();
  
  inheritedBookedBy = parentData?.booked_by || null;
  inheritedDealId = parentData?.deal_id || null;
}

const { error } = await supabase.from('meeting_slot_attendees').insert({
  ...
  deal_id: dealId || inheritedDealId,  // ✅ Usar deal herdado como fallback
  booked_by: inheritedBookedBy,
});
```

---

## Fluxo Corrigido

```text
Adicionar João (Sócio de Rafaela)
│
├── parentAttendeeId = ID da Rafaela
├── selectedParticipant.dealId = Deal da Rafaela ✓
│
└── Inserir João com:
    ├── deal_id = Deal da Rafaela ✓
    └── booked_by = SDR da Rafaela (Caroline) ✓
```

```text
Buscar Notas de João no Drawer
│
├── João.deal_id = Deal da Rafaela ✓
├── Busca notas por deal_id da Rafaela
│
└── Resultado: Nenhuma nota (deal da Rafaela é novo)
    └── OU notas antigas da Rafaela (se existirem)
```

---

## Resultado Esperado

| Participante | deal_id Antes | deal_id Depois | Notas Exibidas |
|--------------|---------------|----------------|----------------|
| Rafaela Bravim | Deal Rafaela | Deal Rafaela | Rafaela ✓ |
| João (Sócio) | null → Antony | Deal Rafaela | Nenhuma ou Rafaela ✓ |
| Antony Elias | Deal Antony | Deal Antony | Antony ✓ |

---

## Impacto

- **Sócios já existentes sem deal_id**: Corrigidos pelo fallback no drawer (parentAttendee.deal_id)
- **Novos sócios**: Já serão criados com o deal_id correto
- **Notas existentes**: Continuam associadas aos deals corretos
- **KPIs/Métricas**: Sem impacto (sócios não afetam contagem por deal)
