
# Plano: Usar contract_paid_at como Fonte da Verdade em Todo Sistema

## Problema Identificado

As metricas de "Contrato Pago" nao estao aparecendo corretamente porque:

1. **useR1CloserMetrics** (linha 184): Query filtra apenas `status === 'contract_paid'`
2. **useCloserDetailData** (linha 148): Filtra apenas `['completed', 'contract_paid']` por status
3. **CloserLeadsTable**: `getStatusBadge` nao considera `contract_paid_at`

Attendees que foram movidos tem `status = 'rescheduled'` mas `contract_paid_at` preenchido.

---

## Solucao

Atualizar todas as queries e filtros para considerar `contract_paid_at IS NOT NULL` como indicador de contrato pago, independente do campo `status`.

---

## Alteracoes

### 1. Arquivo: `src/hooks/useR1CloserMetrics.ts`

**Problema**: Query busca apenas `status === 'contract_paid'`

**Linhas 171-211** - Alterar as 2 queries de contratos para usar `OR`:

```typescript
// Query 1: Contratos COM contract_paid_at no periodo
// Mudar de:
.eq('status', 'contract_paid')
// Para incluir qualquer status quando contract_paid_at existe

// Query 2: Tambem precisa considerar contract_paid_at
```

**Solucao**: Usar uma query que busca `contract_paid_at` preenchido OU `status === 'contract_paid'`

```typescript
// Buscar todos attendees COM contract_paid_at no periodo
const { data: contractsByPaymentDate, error: contractsError } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    id,
    status,
    contract_paid_at,
    booked_by,
    meeting_slot:meeting_slots!inner(...)
  `)
  .eq('meeting_slot.meeting_type', 'r1')
  .not('contract_paid_at', 'is', null)
  .gte('contract_paid_at', start)
  .lte('contract_paid_at', end);
```

**Linhas 379-382** - R1 Realizada tambem deve considerar `contract_paid_at`:

A contagem de R1 Realizada precisa incluir attendees com `contract_paid_at` mesmo se o status for `rescheduled`.

---

### 2. Arquivo: `src/hooks/useCloserDetailData.ts`

**Problema**: Query de leads nao inclui `contract_paid_at` e filtro ignora esses casos

**Linha 118-125** - Adicionar campo `contract_paid_at` na query:

```typescript
meeting_slot_attendees (
  id,
  status,
  deal_id,
  attendee_name,
  attendee_phone,
  booked_by,
  contract_paid_at  // ADICIONAR
)
```

**Linha 136-144** - Adicionar campo na interface interna:

```typescript
const attendeesWithDeals: {
  attendeeId: string;
  status: string;
  contractPaidAt: string | null;  // ADICIONAR
  ...
}[] = [];
```

**Linha 146-159** - Alterar filtro para considerar `contract_paid_at`:

```typescript
meetings?.forEach(meeting => {
  meeting.meeting_slot_attendees?.forEach(att => {
    // Incluir se: status relevante OU contract_paid_at existe
    const hasRelevantStatus = relevantStatuses.includes(att.status);
    const hasContractPaid = !!att.contract_paid_at;
    
    if (att.deal_id && (hasRelevantStatus || hasContractPaid)) {
      attendeesWithDeals.push({
        ...
        // Usar 'contract_paid' como status de display se contract_paid_at existe
        status: att.contract_paid_at ? 'contract_paid' : att.status,
        contractPaidAt: att.contract_paid_at,
      });
    }
  });
});
```

---

### 3. Arquivo: `src/components/closer/CloserLeadsTable.tsx`

**Problema**: Badge usa apenas `status` do lead

**Linha 26 (interface)** - Adicionar campo na interface CloserLead:

No arquivo `useCloserDetailData.ts`, adicionar `contract_paid_at` ao retorno:

```typescript
// Na interface CloserLead
export interface CloserLead {
  ...
  contract_paid_at?: string | null;  // ADICIONAR
}
```

**Linha 40-59** - Modificar `getStatusBadge` para priorizar `contract_paid_at`:

```typescript
const getStatusBadge = (status: string, contractPaidAt?: string | null) => {
  // contract_paid_at tem prioridade
  const displayStatus = contractPaidAt ? 'contract_paid' : status;
  
  switch (displayStatus) {
    case 'contract_paid':
      return (
        <Badge className="bg-amber-500/10 text-amber-400 ...">
          <DollarSign className="h-3 w-3" />
          Contrato Pago
        </Badge>
      );
    // ... resto igual
  }
};
```

**Linha 95** - Passar `contract_paid_at` para a funcao:

```typescript
<TableCell>{getStatusBadge(lead.status, lead.contract_paid_at)}</TableCell>
```

---

## Resumo de Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `useR1CloserMetrics.ts` | Queries para usar `contract_paid_at IS NOT NULL` |
| `useCloserDetailData.ts` | Incluir `contract_paid_at` na query e filtro de leads |
| `CloserLeadsTable.tsx` | Priorizar `contract_paid_at` no badge de status |

---

## Resultado Esperado

Apos as alteracoes:
- KPIs mostrarao contagem correta de "Contrato Pago"
- Tabela de Leads mostrara badge correto para leads com `contract_paid_at`
- Lead "Francisco Antonio da Silva Rocha" aparecera como "Contrato Pago" nos numeros e na tabela
