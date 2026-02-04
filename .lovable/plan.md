

# Plano: Incluir Reunioes Existentes no Calculo de Horarios Visiveis

## Problema Identificado

O lead "Oldai" foi movido para Mateus Macedo em 03/02 (segunda-feira) as 18:00. Porem:

1. Mateus Macedo so tem slot configurado para **terca-feira** (day_of_week: 2) as 18:00
2. A agenda calcula os horarios visiveis baseado apenas nos **slots configurados** em `closer_meeting_links`
3. Como nao ha configuracao para segunda-feira, o horario 18:00 nao aparece na grade
4. Resultado: o lead existe no banco mas nao e visivel na interface

**Dados no banco:**
- Slot ID: 3c3602f2
- Closer: Mateus Macedo (incorporador)
- Data: 2026-02-03 21:00 UTC (18:00 BRT)
- Attendee: Oldai
- Status: rescheduled
- meeting_type: r1

---

## Solucao

Modificar o calculo de `timeSlots` no `AgendaCalendar.tsx` para tambem considerar **reunioes existentes**, nao apenas slots configurados.

---

## Alteracoes

### Arquivo: `src/components/crm/AgendaCalendar.tsx`

**Linhas 137-183** - Atualizar calculo de `timeSlots` para incluir horarios de meetings existentes:

```typescript
const timeSlots = useMemo(() => {
  let minHour = DEFAULT_END_HOUR;
  let maxHour = DEFAULT_START_HOUR;

  // ADICIONAR: Considerar horarios das reunioes existentes
  for (const meeting of meetings) {
    const meetingDate = parseISO(meeting.scheduled_at);
    const hour = meetingDate.getHours();
    const minute = meetingDate.getMinutes();
    minHour = Math.min(minHour, hour);
    const slotEndMinutes = hour * 60 + minute + (meeting.duration_minutes || 60);
    const slotEndHour = Math.ceil(slotEndMinutes / 60);
    maxHour = Math.max(maxHour, slotEndHour);
  }

  // Manter logica existente para slots configurados (R2 e R1)
  if (meetingType === 'r2' && r2DailySlotsMap) {
    // ... codigo existente ...
  } else if (meetingLinkSlots) {
    // ... codigo existente ...
  }

  // Fallback se nenhum slot encontrado
  if (minHour >= maxHour) {
    minHour = DEFAULT_START_HOUR;
    maxHour = DEFAULT_END_HOUR;
  }

  // ... resto do codigo ...
}, [meetingLinkSlots, r2DailySlotsMap, meetingType, meetings]); // Adicionar meetings as dependencias
```

---

## Resultado Esperado

- Reunioes existentes em horarios nao configurados serao visiveis na agenda
- O lead "Oldai" com Mateus Macedo em 03/02 as 18:00 aparecera normalmente
- Admins podem mover leads para qualquer horario sem perder visibilidade
- Compatibilidade mantida com slots configurados

---

## Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `AgendaCalendar.tsx` | Adicionar meetings ao calculo de timeSlots (linhas 137-183) |

