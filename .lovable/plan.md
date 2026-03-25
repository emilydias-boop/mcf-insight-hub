

## Excluir sócios da contagem de leads no header dos closers

### Problema
Os contadores "X / 18 leads" nas colunas de closers (Agenda R1 e R2) incluem attendees marcados como `is_partner = true`, inflando artificialmente a contagem.

### Alterações

**1. `src/components/crm/CloserColumnCalendar.tsx`** (linha ~249)
Substituir:
```ts
const attendeesCount = meeting.attendees?.length || 0;
```
Por:
```ts
const attendeesCount = meeting.attendees?.filter(a => !a.is_partner).length || 0;
```

**2. `src/components/crm/R2CloserColumnCalendar.tsx`** (linha ~163)
Mesma alteração — filtrar `is_partner` antes de contar.

### Resultado
- Sócios continuam visíveis nos slots (comportamento visual mantido)
- Contagem no header reflete apenas leads reais
- Capacidade de slots (`getSlotCapacityInfo`) **não é alterada** — sócios ainda ocupam espaço no slot (decisão de negócio existente)

