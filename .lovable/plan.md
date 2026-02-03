
# Plano: Ocultar Badge "Remanejado" para Status Preservados

## Problema Identificado

O badge "Remanejado" é exibido quando `parent_attendee_id` existe:

```typescript
{!att.is_partner && att.parent_attendee_id && (
  <Badge>Remanejado</Badge>
)}
```

Quando um admin move um lead preservando status (ex: `contract_paid`), o sistema:
1. Cria novo attendee com `parent_attendee_id` (para rastreabilidade)
2. Preserva o `status` como `contract_paid`

Mas a UI mostra "Remanejado" porque `parent_attendee_id` existe, ignorando que o status foi preservado.

---

## Solucao

Modificar a condicao de exibicao do badge "Remanejado" para NAO mostrar quando o status e um dos preservados (`contract_paid`, `completed`, `refunded`, `approved`, `rejected`).

---

## Alteracoes

### 1. Arquivo: `src/components/crm/CloserColumnCalendar.tsx` (linha 372)

**De:**
```typescript
{!att.is_partner && att.parent_attendee_id && (
  <Badge>Remanejado</Badge>
)}
```

**Para:**
```typescript
{!att.is_partner && att.parent_attendee_id && 
 !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(att.status) && (
  <Badge>Remanejado</Badge>
)}
```

### 2. Arquivo: `src/components/crm/AgendaMeetingDrawer.tsx` (linha 627)

**De:**
```typescript
{!p.isPartner && p.parentAttendeeId && (
  <Badge>Remanejado</Badge>
)}
```

**Para:**
```typescript
{!p.isPartner && p.parentAttendeeId && 
 !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(p.status) && (
  <Badge>Remanejado</Badge>
)}
```

---

## Resultado Visual Esperado

| Status | parent_attendee_id | Badge Mostrado |
|--------|-------------------|----------------|
| rescheduled | Sim | **Remanejado** |
| scheduled | Sim | **Remanejado** |
| contract_paid | Sim | ~~Remanejado~~ (oculto) |
| completed | Sim | ~~Remanejado~~ (oculto) |
| refunded | Sim | ~~Remanejado~~ (oculto) |

O lead "Francisco Antonio da Silva Rocha" mostrara apenas o badge de status real ("Contrato Pago") sem o badge "Remanejado".

---

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `CloserColumnCalendar.tsx` | Adicionar condicao de status na exibicao do badge |
| `AgendaMeetingDrawer.tsx` | Adicionar condicao de status na exibicao do badge |
