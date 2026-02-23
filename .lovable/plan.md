

# Ocultar Closers Sem Horario Configurado no Dia

## Problema

Na visualizacao "Por Closer" da agenda, closers que nao tem nenhum horario configurado para o dia selecionado ainda aparecem como colunas vazias, ocupando espaco desnecessario.

## Solucao

Filtrar a lista de `closers` dentro do componente `CloserColumnCalendar` para exibir apenas aqueles que possuem pelo menos um slot configurado no `daySlots` para o dia da semana **OU** que possuem reunioes agendadas para aquele dia.

## Detalhes tecnicos

### Arquivo: `src/components/crm/CloserColumnCalendar.tsx`

Adicionar um `useMemo` apos o carregamento de `daySlots` que filtra os closers:

```typescript
const visibleClosers = useMemo(() => {
  return closers.filter(closer => {
    // Closer tem slot configurado para este dia
    const hasConfiguredSlot = daySlots.some(s => s.closer_id === closer.id);
    // Closer tem reuniao agendada neste dia
    const hasMeeting = meetings.some(m => m.closer_id === closer.id);
    return hasConfiguredSlot || hasMeeting;
  });
}, [closers, daySlots, meetings]);
```

Substituir todas as referencias a `closers` no render (header e grid) por `visibleClosers`.

Isso garante que:
- Closers com horarios configurados aparecem normalmente
- Closers com reunioes agendadas (mesmo sem horario configurado) continuam visiveis
- Closers sem nenhum dos dois ficam ocultos

