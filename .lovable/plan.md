

# Plano: Adicionar Tag de Reagendado e Histórico no R2 (Similar ao R1)

## Objetivo

Replicar a lógica de reagendamento do R1 para o R2, incluindo:
1. Badge visual "Reagendado" nos participantes
2. Registro de histórico via `parent_attendee_id` e `is_reschedule`
3. Atualização de `custom_fields` no deal para rastrear reagendamentos

## Contexto Atual

### Como funciona no R1 (modelo a seguir)
- Quando um lead com no-show é reagendado para um **dia diferente**, o sistema:
  1. Cria um **novo attendee** vinculado ao original via `parent_attendee_id`
  2. Define `is_reschedule = true` e `status = 'rescheduled'`
  3. Atualiza o deal com `custom_fields.is_rescheduled = true` e `reschedule_count`
  4. Exibe badge "Remanejado" com ícone na UI

### Situação atual no R2
- O hook `useRescheduleR2Meeting` apenas atualiza o **slot** existente (data/hora/status)
- Não cria rastreabilidade via `parent_attendee_id`
- Não marca `is_reschedule = true` no attendee
- A interface não exibe badge de reagendado

## Mudanças Necessárias

### 1. Atualizar Queries para Incluir Campos de Rastreamento

**Arquivos:** `src/hooks/useR2AgendaMeetings.ts`, `src/hooks/useR2MeetingsExtended.ts`

Adicionar `is_reschedule` e `parent_attendee_id` nas queries de attendees para que a UI possa exibir a badge.

### 2. Atualizar o Hook de Reagendamento

**Arquivo:** `src/hooks/useR2AgendaData.ts`

Modificar `useRescheduleR2Meeting` para:
- Se o attendee já teve no-show → criar **novo attendee** vinculado via `parent_attendee_id`
- Marcar `is_reschedule = true` no attendee
- Atualizar `custom_fields` do deal com `is_rescheduled`, `reschedule_count`, `last_reschedule_at`
- Manter histórico do agendamento original

### 3. Adicionar Badge "Reagendado" na UI

**Arquivos:** 
- `src/components/crm/R2CloserColumnCalendar.tsx` 
- `src/components/crm/R2MeetingDetailDrawer.tsx`

Exibir badge visual para attendees com `is_reschedule = true` ou `parent_attendee_id` preenchido (igual ao R1).

### 4. Atualizar Tipos

**Arquivo:** `src/types/r2Agenda.ts`

Adicionar campos `is_reschedule` e `parent_attendee_id` no tipo `R2AttendeeExtended`.

---

## Detalhes Técnicos

### Mudança 1: Queries (useR2AgendaMeetings.ts e useR2MeetingsExtended.ts)

```typescript
// Adicionar na query de attendees:
attendees:meeting_slot_attendees(
  id,
  attendee_name,
  attendee_phone,
  status,
  deal_id,
  is_reschedule,        // ← ADICIONAR
  parent_attendee_id,   // ← ADICIONAR
  ...
)
```

### Mudança 2: Hook de Reagendamento (useR2AgendaData.ts)

```typescript
export function useRescheduleR2Meeting() {
  return useMutation({
    mutationFn: async ({ meetingId, newDate, closerId, attendeeId, isNoShowReschedule }) => {
      
      if (isNoShowReschedule && attendeeId) {
        // 1. Buscar dados do attendee original
        const { data: originalAttendee } = await supabase
          .from('meeting_slot_attendees')
          .select('contact_id, deal_id, booked_by, lead_profile, ...')
          .eq('id', attendeeId)
          .single();
        
        // 2. Criar ou encontrar slot de destino
        // (mesma lógica do R1)
        
        // 3. Criar NOVO attendee vinculado ao original
        const { data: newAttendee } = await supabase
          .from('meeting_slot_attendees')
          .insert({
            meeting_slot_id: targetSlotId,
            ...originalAttendee,
            status: 'rescheduled',
            is_reschedule: true,
            parent_attendee_id: attendeeId,  // ← Vincula ao original
          });
        
        // 4. Atualizar deal com marcação de reagendamento
        if (originalAttendee.deal_id) {
          await supabase.from('crm_deals').update({
            custom_fields: {
              ...currentFields,
              is_rescheduled: true,
              reschedule_count: count + 1,
              last_reschedule_at: new Date().toISOString()
            }
          }).eq('id', originalAttendee.deal_id);
        }
      } else {
        // Movimentação simples (mesmo dia ou não é no-show)
        // Manter lógica atual + adicionar is_reschedule: true
      }
    }
  });
}
```

### Mudança 3: UI - Badge Reagendado (R2CloserColumnCalendar.tsx)

```tsx
import { ArrowRightLeft } from 'lucide-react';

// No render de cada attendee:
<div className="flex items-center justify-between gap-1">
  <div className="flex items-center gap-1">
    <span className="truncate font-medium">
      {att.name || att.deal?.contact?.name || "Lead"}
    </span>
    {/* Badge de Reagendado */}
    {att.is_reschedule && (
      <span className="flex items-center bg-orange-500/40 rounded px-0.5">
        <ArrowRightLeft className="h-2.5 w-2.5 text-white flex-shrink-0" />
      </span>
    )}
  </div>
  <Badge ...>
    {ATTENDEE_STATUS_CONFIG[att.status]?.shortLabel}
  </Badge>
</div>
```

E no Tooltip expandido:
```tsx
{att.is_reschedule && (
  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-700 border-orange-300 gap-0.5">
    <ArrowRightLeft className="h-2.5 w-2.5" />
    Reagendado
  </Badge>
)}
```

### Mudança 4: Tipos (r2Agenda.ts)

```typescript
export interface R2AttendeeExtended {
  // ... campos existentes ...
  is_reschedule: boolean | null;        // ← ADICIONAR
  parent_attendee_id: string | null;    // ← ADICIONAR
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/types/r2Agenda.ts` | Adicionar `is_reschedule` e `parent_attendee_id` ao tipo |
| `src/hooks/useR2AgendaMeetings.ts` | Incluir campos na query |
| `src/hooks/useR2MeetingsExtended.ts` | Incluir campos na query |
| `src/hooks/useR2AgendaData.ts` | Refatorar `useRescheduleR2Meeting` para criar histórico |
| `src/components/crm/R2CloserColumnCalendar.tsx` | Adicionar badge "Reagendado" |
| `src/components/crm/R2MeetingDetailDrawer.tsx` | Exibir badge no drawer de detalhes |

---

## Resultado Esperado

1. **Visual:** Leads reagendados após no-show exibirão badge laranja com ícone de setas
2. **Histórico:** O registro original do no-show é preservado e linkado via `parent_attendee_id`
3. **Rastreabilidade:** O deal terá `is_rescheduled = true` e contador de reagendamentos
4. **Consistência:** R2 funcionará igual ao R1 para reagendamentos

