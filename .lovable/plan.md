
# Integrar Notas do Closer R1 nas Notas do Lead

## Problema Identificado

Quando o closer de R1 salva uma nota no drawer de reunião (campo "Notas da Closer para: [Nome]"), essa nota é armazenada em `meeting_slot_attendees.closer_notes`, mas **não é exibida** nas notas consolidadas do lead que os sócios de R2 visualizam.

### Fluxo Atual
| Fonte | Armazenamento | Buscado por useLeadNotes? |
|-------|---------------|---------------------------|
| Nota de agendamento (SDR) | `meeting_slot_attendees.notes` | ✅ Sim |
| **Nota do Closer R1** | `meeting_slot_attendees.closer_notes` | ❌ **NÃO** |
| Notas de attendee | `attendee_notes` | ✅ Sim |
| Notas de ligação | `calls.notes` | ✅ Sim |
| Notas manuais | `deal_activities` | ✅ Sim |

---

## Solução

Modificar o hook `useLeadNotes.ts` para **incluir `closer_notes`** na busca de notas de agendamento.

### Arquivo: `src/hooks/useLeadNotes.ts`

#### Mudança (linhas 122-142):

**De:**
```typescript
// 3. Fetch scheduling notes from meeting_slot_attendees.notes
if (allAttendeeIds.length > 0) {
  const { data: schedulingNotes } = await supabase
    .from('meeting_slot_attendees')
    .select('id, notes, created_at')  // ← SÓ 'notes'
    .in('id', allAttendeeIds)
    .not('notes', 'is', null);
  
  if (schedulingNotes) {
    schedulingNotes.forEach(sn => {
      if (sn.notes) {
        notes.push({
          id: `scheduling-${sn.id}`,
          type: 'scheduling',
          content: sn.notes,
          author: null,
          created_at: sn.created_at || new Date().toISOString(),
        });
      }
    });
  }
}
```

**Para:**
```typescript
// 3. Fetch scheduling notes AND closer notes from meeting_slot_attendees
if (allAttendeeIds.length > 0) {
  const { data: attendeeData } = await supabase
    .from('meeting_slot_attendees')
    .select('id, notes, closer_notes, created_at, updated_at')
    .in('id', allAttendeeIds);
  
  if (attendeeData) {
    attendeeData.forEach(item => {
      // Notas de agendamento (SDR)
      if (item.notes) {
        notes.push({
          id: `scheduling-${item.id}`,
          type: 'scheduling',
          content: item.notes,
          author: null,
          created_at: item.created_at || new Date().toISOString(),
        });
      }
      
      // Notas do Closer R1
      if (item.closer_notes) {
        notes.push({
          id: `closer-${item.id}`,
          type: 'closer',
          content: item.closer_notes,
          author: null, // Poderia buscar o closer name no futuro
          created_at: item.updated_at || item.created_at || new Date().toISOString(),
        });
      }
    });
  }
}
```

---

## Resultado Esperado

### Na aba "Notas" do drawer R2:
| Tipo | Badge | Fonte |
|------|-------|-------|
| Nota SDR | "Nota SDR" (azul) | deal_activities |
| Agendamento | "Agendamento" (roxo) | meeting_slot_attendees.notes |
| **Closer** | **"Closer" (verde)** | **meeting_slot_attendees.closer_notes** ← NOVA |
| Ligação | "Ligação" (âmbar) | calls.notes |
| R2 | "R2" (índigo) | attendee_notes |
| Qualificação | "Qualificação" (teal) | deal_activities (qualification_note) |

---

## Melhoria Futura (Opcional)

Para mostrar o **nome do closer** que escreveu a nota, podemos fazer um JOIN com `meeting_slots` → `closers`:

```typescript
const { data: attendeeData } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    id, notes, closer_notes, created_at, updated_at,
    meeting_slots(closers(name))
  `)
  .in('id', allAttendeeIds);

// E usar:
author: item.meeting_slots?.closers?.name || 'Closer'
```

---

## Resumo

| Item | Valor |
|------|-------|
| **Arquivo** | `src/hooks/useLeadNotes.ts` |
| **Linhas** | 122-142 |
| **Mudança** | Adicionar `closer_notes` na query e criar entrada com `type: 'closer'` |
| **Impacto** | Notas do Closer R1 aparecem no R2 NotesTab |
| **Risco** | Baixo (apenas adiciona dados, não remove nada) |
