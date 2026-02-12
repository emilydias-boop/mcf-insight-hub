
# Corrigir Visibilidade de Reunioes Agendadas Fora de Slots Configurados

## Problema
O calendario da Agenda R2 so exibe linhas de horarios que estao configurados nos slots diarios/semanais do closer. Se uma reuniao foi agendada em um horario que nao esta (ou deixou de estar) configurado, ela fica invisivel no grid -- mesmo existindo no banco de dados.

Caso concreto: Bruno da Silva Oliveira foi agendado para Jessica Bellini em 11/02/2026 as 19:30, mas os slots configurados para esse dia sao apenas 09:00, 15:00 e 18:00. O horario 19:30 nao aparece no grid.

## Solucao
Alterar a logica de filtragem de `timeSlots` no `R2CloserColumnCalendar` para tambem incluir horarios que possuem reunioes agendadas, mesmo que nao estejam configurados. Isso garante que nenhuma reuniao existente fique invisivel.

## Arquivo a Modificar

### `src/components/crm/R2CloserColumnCalendar.tsx`

Alterar o `useMemo` de `timeSlots` (linhas 115-129) para:

1. Coletar todos os horarios configurados (como ja faz)
2. Tambem coletar os horarios de reunioes existentes no dia selecionado
3. Unir ambos os conjuntos para formar a lista final de horarios visiveis

```typescript
const timeSlots = useMemo(() => {
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  // 1. Horarios configurados
  const configuredTimes = new Set<string>();
  if (configuredSlotsMap) {
    const dateSlots = configuredSlotsMap[dateStr];
    if (dateSlots) {
      Object.keys(dateSlots).forEach(t => configuredTimes.add(t));
    }
  }
  
  // 2. Horarios com reunioes existentes (mesmo se nao configurados)
  meetings.forEach(m => {
    const meetingTime = parseISO(m.scheduled_at);
    if (isSameDay(meetingTime, selectedDate)) {
      const timeStr = format(meetingTime, 'HH:mm');
      configuredTimes.add(timeStr);
    }
  });
  
  if (configuredTimes.size === 0 && !configuredSlotsMap) {
    return ALL_TIME_SLOTS; // Fallback se nao tem mapa
  }
  
  if (configuredTimes.size === 0) return [];
  
  return ALL_TIME_SLOTS.filter(slot => configuredTimes.has(slot.label));
}, [configuredSlotsMap, selectedDate, meetings]);
```

## Secao Tecnica

- A mudanca e isolada no calculo de `timeSlots` -- nenhum outro componente ou hook e afetado
- Reunioes em horarios nao-configurados aparecerao no grid, mas o botao "Livre" nao sera exibido (a logica de `isSlotAvailable` ja verifica se o slot e configurado)
- Isso resolve tanto o caso de slots removidos apos agendamento quanto agendamentos feitos via fluxo que nao validou disponibilidade
- A reuniao da Jessica Bellini as 19:30 passara a ser visivel imediatamente
