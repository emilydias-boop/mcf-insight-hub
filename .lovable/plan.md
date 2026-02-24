

## Corrigir: Reunioes desaparecem ao remover horario configurado

### Problema

Quando um horario e removido da configuracao de disponibilidade de uma semana especifica (ex: sabado), as reunioes que ja estavam agendadas nesse horario desaparecem do calendario do gestor. Isso acontece porque o grid de horarios e construido apenas a partir dos slots configurados, ignorando reunioes existentes em horarios nao-configurados.

O problema afeta duas visoes:

1. **Visao "Por Closer"** (`CloserColumnCalendar.tsx`): A lista de horarios (`timeSlots`) e gerada exclusivamente a partir dos `daySlots` configurados (linha 137-144). Se o slot foi removido da configuracao, o horario inteiro desaparece do grid, levando as reunioes junto.

2. **Visao "Calendario"** (`AgendaCalendar.tsx`): A funcao `getAllConfiguredClosersForDay` (linha 548) so retorna closers que tem slots configurados. Se todos os slots de um closer foram removidos para aquele dia, o closer some do grid e suas reunioes ficam invisiveis.

### Solucao

Expandir a geracao de `timeSlots` e `closers visiveis` para incluir horarios e closers que tenham reunioes existentes, mesmo que o slot de configuracao tenha sido removido.

### Alteracoes

**`src/components/crm/CloserColumnCalendar.tsx`**

Modificar o `useMemo` de `timeSlots` (linha 137-144) para tambem incluir horarios de reunioes existentes:

```
Antes:
  const timeSlots = useMemo(() => {
    const uniqueTimes = [...new Set(daySlots.map(s => s.start_time))].sort();
    return uniqueTimes.map(timeStr => ...);
  }, [daySlots, selectedDate]);

Depois:
  const timeSlots = useMemo(() => {
    // Horarios dos slots configurados
    const configuredTimes = daySlots.map(s => s.start_time.slice(0, 5));
    
    // Horarios de reunioes existentes (podem estar em slots removidos)
    const meetingTimes = meetings.map(m => {
      const d = parseISO(m.scheduled_at);
      if (!isSameDay(d, selectedDate)) return null;
      return format(d, 'HH:mm');
    }).filter(Boolean);
    
    // Unir e ordenar
    const uniqueTimes = [...new Set([...configuredTimes, ...meetingTimes])].sort();
    return uniqueTimes.map(timeStr => {
      const [hour, minute] = timeStr.split(':').map(Number);
      return setMinutes(setHours(selectedDate, hour), minute);
    });
  }, [daySlots, meetings, selectedDate]);
```

**`src/components/crm/AgendaCalendar.tsx`**

Modificar `getAllConfiguredClosersForDay` (linha 548-570) para tambem incluir closers que tenham reunioes no dia, mesmo sem slots configurados:

```
Antes:
  // So busca closers dos slots configurados
  
Depois:
  // Buscar closers dos slots configurados (logica existente)
  // + Adicionar closers que tenham reunioes nesse dia
  const dayMeetings = filteredMeetings.filter(m => 
    isSameDay(parseISO(m.scheduled_at), day)
  );
  dayMeetings.forEach(m => {
    if (m.closer_id) allCloserIdsSet.add(m.closer_id);
  });
```

### Resultado esperado

- Reunioes agendadas em horarios que foram removidos da configuracao continuarao visiveis no calendario
- Os horarios aparecerao como linhas no grid (sem o botao "+Agendar", ja que nao estao configurados)
- O closer aparecera como coluna no dia, mesmo sem slots configurados, se tiver reunioes
- A funcionalidade de remover horarios continua funcionando normalmente para slots futuros vazios
