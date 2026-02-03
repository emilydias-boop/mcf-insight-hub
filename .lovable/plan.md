
# Plano: Corrigir Badge "Remanejado/Reagendado" em Todos os Componentes

## Problema

O badge "Remanejado/Reagendado" aparece mesmo quando o lead tem status preservado (`contract_paid`, `completed`, etc). Isso ocorre porque a UI verifica apenas:
- `is_reschedule` (R2)
- `parent_attendee_id` (R1)

Sem considerar se o status real deveria ter prioridade visual.

---

## Arquivos a Corrigir

### 1. R2MeetingDetailDrawer.tsx (linha 205-210)

**De:**
```tsx
{att.is_reschedule && (
  <Badge>Reagendado</Badge>
)}
```

**Para:**
```tsx
{att.is_reschedule && 
 !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(att.status || '') && (
  <Badge>Reagendado</Badge>
)}
```

---

### 2. R2CloserColumnCalendar.tsx (linhas 270-274 - icone compacto)

**De:**
```tsx
{(att as any).is_reschedule && (
  <span className="flex items-center bg-orange-500/40 rounded px-0.5 shrink-0">
    <ArrowRightLeft className="h-2.5 w-2.5 text-white" />
  </span>
)}
```

**Para:**
```tsx
{(att as any).is_reschedule && 
 !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(att.status) && (
  <span className="flex items-center bg-orange-500/40 rounded px-0.5 shrink-0">
    <ArrowRightLeft className="h-2.5 w-2.5 text-white" />
  </span>
)}
```

---

### 3. R2CloserColumnCalendar.tsx (linhas 306-311 - tooltip)

**De:**
```tsx
{(att as any).is_reschedule && (
  <Badge>Reagendado</Badge>
)}
```

**Para:**
```tsx
{(att as any).is_reschedule && 
 !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(att.status) && (
  <Badge>Reagendado</Badge>
)}
```

---

### 4. CloserColumnCalendar.tsx (linhas 324-328 - icone compacto R1)

**De:**
```tsx
{!att.is_partner && att.parent_attendee_id && (
  <span className="flex items-center bg-orange-500/40 rounded px-0.5">
    <ArrowRightLeft className="h-2.5 w-2.5 text-white flex-shrink-0" />
  </span>
)}
```

**Para:**
```tsx
{!att.is_partner && att.parent_attendee_id && 
 !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(att.status) && (
  <span className="flex items-center bg-orange-500/40 rounded px-0.5">
    <ArrowRightLeft className="h-2.5 w-2.5 text-white flex-shrink-0" />
  </span>
)}
```

---

### 5. MeetingsList.tsx (linhas 95-99)

**De:**
```tsx
{!att.is_partner && att.parent_attendee_id && (
  <Badge>Remanej.</Badge>
)}
```

**Para:**
```tsx
{!att.is_partner && att.parent_attendee_id && 
 !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(att.status) && (
  <Badge>Remanej.</Badge>
)}
```

---

## Resultado Esperado

| Status Real | is_reschedule/parent_id | Badge Mostrado |
|-------------|------------------------|----------------|
| contract_paid | true | **Nenhum badge laranja** |
| completed | true | **Nenhum badge laranja** |
| refunded | true | **Nenhum badge laranja** |
| rescheduled | true | Remanejado/Reagendado |
| scheduled | true | Remanejado/Reagendado |

O lead "Francisco Antonio da Silva Rocha" mostrara apenas seu status real ("Contrato Pago") sem o badge redundante "Remanejado".

---

## Resumo de Alteracoes

| Arquivo | Local | Tipo |
|---------|-------|------|
| R2MeetingDetailDrawer.tsx | Badge na lista de participantes | R2 Drawer |
| R2CloserColumnCalendar.tsx | Icone compacto + tooltip | R2 Calendar |
| CloserColumnCalendar.tsx | Icone compacto | R1 Calendar |
| MeetingsList.tsx | Badge na lista | Lista de reunioes |
