
# Plano: Corrigir Horários do Modal de Reagendamento R2

## Problema Identificado

O modal "Reagendar Reunião R2" (`R2RescheduleModal.tsx`) usa slots de tempo **fixos** de 30 minutos (09:00 a 18:00), em vez de buscar os horários configurados para o closer selecionado.

| Modal | Implementação | Comportamento |
|-------|---------------|---------------|
| `R2QuickScheduleModal` | Usa `useR2CloserAvailableSlots` | ✅ Mostra horários configurados do closer |
| `R2RescheduleModal` | Usa array fixo `TIME_SLOTS` | ❌ Mostra apenas 09:00-18:00 em intervalos de 30min |

O código problemático está nas linhas 46-51:
```typescript
// Fixed time slots for R2 (9:00 to 18:00, 30-min intervals)
const TIME_SLOTS = Array.from({ length: 19 }, (_, i) => {
  ...
});
```

---

## Solução

Atualizar o `R2RescheduleModal` para usar o mesmo padrão do `R2QuickScheduleModal`:

1. Importar e usar o hook `useR2CloserAvailableSlots`
2. Buscar os horários configurados baseado no closer e data selecionados
3. Mostrar disponibilidade com indicadores visuais (ocupado/disponível)

---

## Arquivo a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/crm/R2RescheduleModal.tsx` | **Modificar** - Usar `useR2CloserAvailableSlots` em vez de TIME_SLOTS fixo |

---

## Alterações Detalhadas

### 1. Adicionar imports necessários

```typescript
import { Loader2, ExternalLink } from 'lucide-react';
import { useR2CloserAvailableSlots } from '@/hooks/useR2CloserAvailableSlots';
```

### 2. Remover TIME_SLOTS estático

Remover linhas 46-51 (o array fixo não será mais necessário).

### 3. Adicionar chamada do hook

Dentro do componente, após os estados existentes:

```typescript
// Fetch available slots for selected closer + date
const { data: closerSlots, isLoading: loadingSlots } = useR2CloserAvailableSlots(
  selectedCloser || undefined,
  selectedDate
);

// Available time slots based on closer configuration
const availableTimeSlots = useMemo(() => {
  if (!closerSlots) return [];
  return closerSlots.availableSlots.filter(s => s.isAvailable);
}, [closerSlots]);

// All configured slots (for showing occupied ones too)
const allConfiguredSlots = useMemo(() => {
  if (!closerSlots) return [];
  return closerSlots.availableSlots;
}, [closerSlots]);
```

### 4. Adicionar reset do horário quando closer/data mudam

```typescript
// Reset time when closer or date changes
useEffect(() => {
  setSelectedTime('');
}, [selectedCloser, selectedDate]);
```

### 5. Atualizar UI do seletor de horário

Substituir o Select de horário atual por:

```tsx
<div className="space-y-2">
  <Label className="flex items-center gap-1">
    Horário
    {loadingSlots && <Loader2 className="h-3 w-3 animate-spin" />}
  </Label>
  <Select 
    value={selectedTime} 
    onValueChange={setSelectedTime}
    disabled={!selectedCloser || !selectedDate || loadingSlots || availableTimeSlots.length === 0}
  >
    <SelectTrigger>
      <Clock className="h-4 w-4 mr-2" />
      <SelectValue placeholder={getTimePlaceholder()} />
    </SelectTrigger>
    <SelectContent>
      {allConfiguredSlots.map(slot => (
        <SelectItem 
          key={slot.time} 
          value={slot.time}
          disabled={!slot.isAvailable}
          className={cn(!slot.isAvailable && "opacity-50")}
        >
          <span className="flex items-center gap-2">
            {slot.time}
            {slot.link && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
            {!slot.isAvailable && <span className="text-xs text-destructive">(ocupado)</span>}
          </span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

### 6. Adicionar helper para placeholder dinâmico

```typescript
const getTimePlaceholder = () => {
  if (!selectedCloser) return 'Selecione closer';
  if (!selectedDate) return 'Selecione data';
  if (loadingSlots) return 'Carregando...';
  if (allConfiguredSlots.length === 0) return 'Sem horários';
  if (availableTimeSlots.length === 0) return 'Todos ocupados';
  return 'Selecione';
};
```

### 7. Adicionar mensagem quando não há horários

Abaixo do grid de data/hora:

```tsx
{selectedCloser && selectedDate && !loadingSlots && allConfiguredSlots.length === 0 && (
  <p className="text-xs text-amber-600">
    Closer sem horários configurados para {format(selectedDate, 'EEEE', { locale: ptBR })}.
  </p>
)}
```

### 8. Atualizar validação do botão submit

```typescript
disabled={
  !selectedDate || 
  !selectedTime || 
  rescheduleMeeting.isPending || 
  updateAttendee.isPending
}
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Dropdown com 09:00-18:00 em intervalos de 30min | Dropdown com horários configurados do closer |
| Sem indicação de ocupação | Mostra "(ocupado)" e desabilita slots cheios |
| Permite agendar em horários não configurados | Só permite horários válidos do closer |
| Sem feedback visual de loading | Mostra spinner enquanto carrega |

---

## Fluxo do Usuário

```text
1. Seleciona Closer "Jessica Bellini"
   └── (aguarda seleção de data)

2. Seleciona Data "29/01/2026"
   └── Hook busca horários de Jessica para 29/01
   └── Retorna: 09:00, 10:30, 11:00, 14:00, 15:30

3. Abre dropdown de Horário
   └── Mostra apenas os 5 horários configurados
   └── Horários ocupados aparecem desabilitados com "(ocupado)"

4. Seleciona horário disponível e reagenda ✓
```

---

## Impacto

- **Consistência**: Mesmo comportamento do modal de agendamento
- **Precisão**: Só permite horários realmente configurados
- **UX**: Feedback visual de disponibilidade
- **Integridade**: Respeita capacidade máxima por slot do closer
