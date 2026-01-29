
# Plano: Corrigir Atribuição de SDR para Sócios

## Problema Identificado

Quando um sócio (partner) é adicionado a um lead, o campo "SDR que Agendou" mostra o SDR errado. No exemplo:
- **Rafaela Bravim** → Corretamente mostra Caroline Souza
- **Gilmar Melo (Sócio de Rafaela)** → Erroneamente mostra Antony Elias (deveria ser Caroline Souza)

Isso ocorre porque sócios herdam o `booked_by_profile` do **meeting slot** em vez do **parent attendee**.

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/crm/AgendaMeetingDrawer.tsx` | **Modificar** - Corrigir fallback do bookedByProfile |
| `src/hooks/useAgendaData.ts` | **Modificar** - Herdar booked_by do parent ao criar sócio |

---

## Alterações

### 1. AgendaMeetingDrawer.tsx (linhas 451 e 455)

O problema está no fallback que não considera o parent attendee:

De:
```typescript
bookedBy: att.booked_by || activeMeeting.booked_by,
...
bookedByProfile: att.booked_by_profile || activeMeeting.booked_by_profile,
```

Para:
```typescript
bookedBy: att.booked_by || parentAttendee?.booked_by || activeMeeting.booked_by,
...
bookedByProfile: att.booked_by_profile || parentAttendee?.booked_by_profile || activeMeeting.booked_by_profile,
```

Isso garante que sócios herdem a informação do SDR do lead principal (parent) antes de cair no fallback do meeting slot.

### 2. useAgendaData.ts - Hook useAddMeetingAttendee (linha 1048)

Ao adicionar um sócio com `parentAttendeeId`, devemos buscar o `booked_by` do parent e herdar:

De:
```typescript
const { error } = await supabase.from('meeting_slot_attendees').insert({
  meeting_slot_id: meetingSlotId,
  deal_id: dealId || null,
  ...
});
```

Para:
```typescript
// Se for sócio, herdar booked_by do parent
let inheritedBookedBy: string | null = null;
if (parentAttendeeId) {
  const { data: parentData } = await supabase
    .from('meeting_slot_attendees')
    .select('booked_by')
    .eq('id', parentAttendeeId)
    .single();
  
  inheritedBookedBy = parentData?.booked_by || null;
}

const { error } = await supabase.from('meeting_slot_attendees').insert({
  meeting_slot_id: meetingSlotId,
  deal_id: dealId || null,
  booked_by: inheritedBookedBy,
  ...
});
```

---

## Fluxo Corrigido

```text
Adicionar Sócio de Rafaela (Gilmar)
│
├── parentAttendeeId = ID da Rafaela
├── Buscar booked_by de Rafaela → Caroline Souza (UUID)
│
└── Inserir Gilmar com:
    └── booked_by = UUID da Caroline Souza ✓
```

```text
Exibir "SDR que Agendou Gilmar" no Drawer
│
├── Gilmar.booked_by_profile → (preenchido agora)
├── FALLBACK: parentAttendee.booked_by_profile → Caroline Souza ✓
└── FALLBACK: activeMeeting.booked_by_profile → (não usado mais)
```

---

## Resultado Esperado

| Participante | Antes | Depois |
|--------------|-------|--------|
| Rafaela Bravim | Caroline Souza | Caroline Souza ✓ |
| Gilmar Melo (Sócio de Rafaela) | Antony Elias ❌ | Caroline Souza ✓ |
| João Victor Costa | Antony Elias | Antony Elias ✓ |

---

## Impacto

- **Sócios já existentes sem booked_by**: Serão corrigidos pela nova lógica de fallback no drawer
- **Novos sócios**: Já terão o booked_by corretamente preenchido na inserção
- **Notas**: As notas continuarão agregadas por deal_id, sem impacto
