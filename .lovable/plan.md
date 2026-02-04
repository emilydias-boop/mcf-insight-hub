
# Plano: Corrigir Modal "Mover Participante" para Usar closer_meeting_links

## Problema

O modal "Mover Participante" usa a tabela `closer_availability`, enquanto o calendário da agenda usa `closer_meeting_links`. Mateus Macedo tem horários apenas em `closer_meeting_links`:

- **closer_meeting_links**: Terça-feira 18:00 
- **closer_availability**: Vazia

## Solucao

Atualizar o `MoveAttendeeModal` para usar `useCloserDaySlots` (que busca de `closer_meeting_links`) ao inves de `useCloserAvailability`.

---

## Alteracoes

### Arquivo: `src/components/crm/MoveAttendeeModal.tsx`

**1. Atualizar imports (linha 29)**

De:
```typescript
import { useClosers, useCloserAvailability, useBookedSlots } from '@/hooks/useCloserScheduling';
```

Para:
```typescript
import { useClosers, useBookedSlots } from '@/hooks/useCloserScheduling';
import { useCloserDaySlots } from '@/hooks/useCloserMeetingLinks';
```

**2. Trocar hook de disponibilidade (linha 79)**

De:
```typescript
const { data: availability } = useCloserAvailability();
```

Para:
```typescript
const dayOfWeek = selectedDate ? selectedDate.getDay() : 0;
const { data: daySlots } = useCloserDaySlots(dayOfWeek, 'r1');
```

**3. Reescrever logica de availableSlots (linhas 88-136)**

A logica atual itera por ranges de horarios (start_time -> end_time) e gera slots a cada X minutos. A nova logica usa slots exatos da tabela `closer_meeting_links`:

```typescript
const availableSlots = useMemo(() => {
  if (!selectedDate || !closers || !daySlots) return [];
  
  const slots: AvailableSlot[] = [];
  
  for (const slot of daySlots) {
    const closer = closers.find(c => c.id === slot.closer_id);
    if (!closer) continue;
    
    // Parse o horario do slot (formato HH:mm:ss)
    const [hour, minute] = slot.start_time.split(':').map(Number);
    const slotTime = setMinutes(setHours(startOfDay(selectedDate), hour), minute);
    
    // Verificar se o slot e no futuro
    if (isAfter(slotTime, new Date())) {
      // Verificar se ja esta reservado
      const isBooked = bookedSlots?.some(booked => {
        const bookedTime = new Date(booked.scheduled_at);
        return booked.closer_id === closer.id && 
          format(bookedTime, 'HH:mm') === format(slotTime, 'HH:mm');
      });
      
      // Admin pode ver todos os horarios, mesmo os reservados
      if (isAdmin || !isBooked) {
        slots.push({
          closerId: closer.id,
          closerName: closer.name,
          closerColor: (closer as any).color || '#3B82F6',
          datetime: new Date(slotTime),
          duration: 60, // duracao padrao
          isBooked: isBooked,
        });
      }
    }
  }
  
  return slots.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
}, [selectedDate, closers, daySlots, bookedSlots, isAdmin]);
```

---

## Resultado Esperado

- Mateus Macedo aparecera com slot as 18:00 na terca-feira no modal "Mover Participante"
- Todos os closers com horarios em `closer_meeting_links` serao visiveis
- Consistencia entre o calendario da agenda e o modal de mover

---

## Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `MoveAttendeeModal.tsx` | Trocar `useCloserAvailability` por `useCloserDaySlots` e reescrever logica de slots |
