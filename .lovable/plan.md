
# Plano: Usar contract_paid_at como Fonte da Verdade para Badge

## Problema

O lead "Francisco Antonio da Silva Rocha" tem:
- `status` = `rescheduled` (incorreto, foi sobrescrito durante movimento)
- `contract_paid_at` = preenchido (indica que contrato foi pago)

O badge mostra "Reagendada" porque usa `status`, mas deveria mostrar "Contrato Pago" baseado em `contract_paid_at`.

---

## Solucao

Modificar a logica do badge de status para verificar `contract_paid_at` primeiro. Se existir, mostrar "Contrato Pago" independente do valor de `status`.

---

## Alteracoes

### Arquivo: `src/components/crm/AgendaMeetingDrawer.tsx`

**Linha 641-644** - Badge de Status Individual:

**De:**
```tsx
{/* Individual Status Badge */}
{p.status && p.status !== 'scheduled' && (
  <Badge className={cn('text-xs text-white', STATUS_LABELS[p.status]?.color || 'bg-muted')}>
    {STATUS_LABELS[p.status]?.label || p.status}
  </Badge>
)}
```

**Para:**
```tsx
{/* Individual Status Badge - contract_paid_at takes priority */}
{(() => {
  // Se tem contract_paid_at, sempre mostrar Contrato Pago
  const displayStatus = p.contractPaidAt ? 'contract_paid' : p.status;
  if (!displayStatus || displayStatus === 'scheduled') return null;
  return (
    <Badge className={cn('text-xs text-white', STATUS_LABELS[displayStatus]?.color || 'bg-muted')}>
      {STATUS_LABELS[displayStatus]?.label || displayStatus}
    </Badge>
  );
})()}
```

### Arquivo: `src/hooks/useAgendaData.ts`

Garantir que `contract_paid_at` seja incluido na query e mapeado para os participantes.

**Na interface MeetingAttendee (linha 9-42):**

Adicionar:
```typescript
contract_paid_at?: string | null;
```

**Na query de meetings** - incluir o campo `contract_paid_at` no select dos attendees.

---

## Logica Final

| contract_paid_at | status | Badge Mostrado |
|------------------|--------|----------------|
| preenchido | rescheduled | **Contrato Pago** |
| preenchido | scheduled | **Contrato Pago** |
| null | contract_paid | Contrato Pago |
| null | completed | Realizada |
| null | rescheduled | Reagendada |

---

## Resultado

O lead "Francisco Antonio da Silva Rocha" mostrara:
- Badge "Contrato Pago" (verde) baseado em `contract_paid_at`
- Sem badge "Reagendada" redundante

Isso funciona para todos os casos historicos sem necessidade de corrigir dados manualmente.
