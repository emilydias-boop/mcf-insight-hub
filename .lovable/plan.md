
# Corrigir Horários do RescheduleModal (R1) para Usar Slots Configurados

## Problema

O modal de reagendamento R1 (`RescheduleModal.tsx`) mostra horarios genericos hardcoded (08:00, 08:15, 08:30...) em vez dos horarios realmente configurados para o closer selecionado. O modal R2 (`R2RescheduleModal.tsx`) ja faz isso corretamente usando `useR2CloserAvailableSlots`.

## Solucao

Atualizar o `RescheduleModal` para buscar os horarios configurados do closer selecionado na tabela `closer_meeting_links`, similar ao que o R2RescheduleModal faz.

## Detalhes Tecnicos

### Arquivo: `src/components/crm/RescheduleModal.tsx`

**1. Adicionar hook de slots configurados**

Usar `useCloserMeetingLinksList` do hook existente para buscar os horarios configurados do closer selecionado para o dia da semana da data selecionada:

```typescript
import { useCloserMeetingLinksList } from '@/hooks/useCloserMeetingLinks';
import { getDay } from 'date-fns';

// Dentro do componente:
const dayOfWeek = selectedDate ? getDay(selectedDate) : undefined;
const { data: configuredLinks, isLoading: loadingSlots } = useCloserMeetingLinksList(
  selectedCloser || undefined,
  dayOfWeek
);
```

**2. Substituir slots hardcoded por slots configurados**

Remover o array hardcoded `timeSlots` (linhas 66-70) e usar os slots configurados:

```typescript
const availableTimeSlots = useMemo(() => {
  if (!configuredLinks) return [];
  return configuredLinks.map(link => link.start_time.substring(0, 5));
}, [configuredLinks]);
```

**3. Atualizar o Select de horarios**

- Desabilitar o select quando nao ha closer/data selecionados ou esta carregando
- Mostrar placeholder contextual ("Selecione closer", "Selecione data", "Carregando...", "Sem horarios")
- Adicionar indicador de loading (spinner)
- Mostrar mensagem quando nao ha horarios configurados

**4. Resetar horario ao trocar closer/data**

Adicionar `useEffect` para limpar `selectedTime` quando o closer ou a data mudar, igual ao R2RescheduleModal (linha 121-123).

### Resultado

- O select de horarios mostrara apenas os horarios realmente configurados para aquele closer naquele dia da semana
- Se o closer nao tem horarios configurados para o dia selecionado, aparecera uma mensagem informativa
- Comportamento consistente com o R2RescheduleModal
