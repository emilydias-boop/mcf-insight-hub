
# Plano: Corrigir Sobreposicao de Closers na Visualizacao Diaria do Calendario R2

## Problema Identificado

Na visualizacao de **Dia** do Calendario R2, quando multiplos closers (Jessica, Thobson, Claudia) tem slots disponiveis no mesmo horario, seus marcadores estao se sobrepondo em vez de aparecerem lado a lado em colunas separadas.

### Causa Raiz

O calculo de `activeClosersForDayView` (linhas 776-798 do `AgendaCalendar.tsx`) so inclui closers que:
1. **Tem reunioes** agendadas no dia, OU
2. Sao closers ativos **SE nao houver nenhuma reuniao**

O problema ocorre quando **alguns closers tem reunioes** mas **outros closers tem apenas slots disponiveis** (sem reunioes). Nesse cenario, os closers "disponiveis" nao sao incluidos nas colunas do grid, resultando em sobreposicao visual.

### Exemplo do Bug

| Closer | Tem Reuniao | Tem Slot Configurado | Incluido no Grid |
|--------|-------------|----------------------|------------------|
| Julio | Sim | Sim | Sim |
| Jessica | Nao | Sim | **NAO** (Bug!) |
| Thobson | Nao | Sim | **NAO** (Bug!) |
| Claudia | Nao | Sim | **NAO** (Bug!) |

Resultado: Jessica, Thobson e Claudia sao renderizados sobrepostos dentro de uma unica coluna.

## Solucao Proposta

Modificar o calculo de `activeClosersForDayView` para usar `getAllConfiguredClosersForDay` que ja existe no codigo e retorna **todos os closers que tem QUALQUER slot configurado** para o dia:

### Codigo Atual (Linha 776-798)

```typescript
const activeClosersForDayView = useMemo(() => {
  if (viewMode !== 'day') return [];
  const day = viewDays[0];
  if (!day) return [];
  
  const closerIds = new Set<string>();
  
  // PROBLEMA: So adiciona closers com reunioes
  filteredMeetings.forEach(m => {
    if (isSameDay(parseISO(m.scheduled_at), day) && m.closer_id) {
      closerIds.add(m.closer_id);
    }
  });
  
  // So usa todos os closers se NAO houver nenhuma reuniao
  if (closerIds.size === 0) {
    closers.filter(c => c.is_active).forEach(c => closerIds.add(c.id));
  }
  
  return [...closerIds].sort();
}, [viewMode, viewDays, filteredMeetings, closers]);
```

### Codigo Corrigido

```typescript
const activeClosersForDayView = useMemo(() => {
  if (viewMode !== 'day') return [];
  const day = viewDays[0];
  if (!day) return [];
  
  // CORRECAO: Usar TODOS os closers configurados para o dia
  // (nao apenas os que tem reunioes)
  return getAllConfiguredClosersForDay(day);
}, [viewMode, viewDays, getAllConfiguredClosersForDay]);
```

## Mudancas Necessarias

| Arquivo | Tipo de Mudanca |
|---------|-----------------|
| `src/components/crm/AgendaCalendar.tsx` | Modificar 1 funcao |

### Detalhes da Modificacao

**Linhas 776-798**: Substituir o calculo de `activeClosersForDayView` para usar a funcao existente `getAllConfiguredClosersForDay` que ja considera todos os closers com slots configurados (baseado em `r2DailySlotsMap` para R2 ou `meetingLinkSlots` para R1).

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Jessica, Thobson, Claudia sobrepostos | Cada closer em coluna separada |
| Grid com 1 coluna (apenas closers com reunioes) | Grid com 3+ colunas (todos os closers configurados) |
| Dificil visualizar disponibilidade | Visualizacao clara por closer |

### Visualizacao Esperada

```text
| Hora  | Jessica | Thobson | Claudia |
|-------|---------|---------|---------|
| 10:30 | + Livre | + Livre | + Livre |
| 10:45 | Reuniao | + Livre | + Livre |
| 11:00 | + Livre | + Livre | + Livre |
```

## Secao Tecnica

### Funcao Existente que Sera Reutilizada

A funcao `getAllConfiguredClosersForDay` (linhas 461-483) ja faz exatamente o que precisamos:

```typescript
const getAllConfiguredClosersForDay = useCallback((day: Date) => {
  const allCloserIdsSet = new Set<string>();
  
  if (meetingType === 'r2' && r2DailySlotsMap) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dateSlots = r2DailySlotsMap[dateStr];
    if (dateSlots) {
      Object.values(dateSlots).forEach(slotInfo => {
        slotInfo.closerIds.forEach(id => allCloserIdsSet.add(id));
      });
    }
  } else {
    const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
    const slots = meetingLinkSlots?.[dayOfWeek] || [];
    slots.forEach(slot => {
      slot.closerIds.forEach(id => allCloserIdsSet.add(id));
    });
  }
  
  return Array.from(allCloserIdsSet).sort();
}, [meetingType, r2DailySlotsMap, meetingLinkSlots]);
```

### Consistencia com Outras Views

Essa correcao alinha o Day View com o Week View, que ja usa `getSlotGridInfo` → `getAllConfiguredClosersForDay` para calcular o grid de closers.
