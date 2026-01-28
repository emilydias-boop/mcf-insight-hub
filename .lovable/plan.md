
# Contabilizar Contratos de Follow-up por Data do Pagamento

## Problema Identificado
O painel de métricas de Closers filtra reuniões apenas por `scheduled_at` (data da reunião original). Quando um **follow-up** resulta em pagamento de contrato **hoje**, mas a reunião foi em **outro dia**, esse contrato **não é contabilizado** nas métricas do dia.

**Exemplo Real:**
- Thayna teve reunião dia 25/01 com um lead
- Fez follow-up e o lead pagou o contrato dia 28/01
- O sistema mostra 3 contratos pagos para hoje (reuniões de hoje)
- Mas o contrato do follow-up não aparece porque `scheduled_at` é 25/01

---

## Solução Proposta

Criar uma **contagem adicional** de contratos pagos baseada na data do pagamento (`contract_paid_at`), não na data da reunião.

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useR1CloserMetrics.ts` | Adicionar busca de contratos por `contract_paid_at` no período |

---

## Mudanças Técnicas

### 1. Nova Query para Contratos por Data de Pagamento

Adicionar query que busca attendees com:
- `status = 'contract_paid'`
- `contract_paid_at` dentro do período selecionado
- Independente da data do `scheduled_at`

```typescript
// Buscar contratos pagos pela DATA DO PAGAMENTO (não da reunião)
const { data: contractsByPaymentDate } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    id,
    status,
    contract_paid_at,
    booked_by,
    meeting_slot:meeting_slots!inner(
      closer_id,
      meeting_type
    )
  `)
  .eq('status', 'contract_paid')
  .eq('meeting_slots.meeting_type', 'r1')
  .gte('contract_paid_at', start)
  .lte('contract_paid_at', end);
```

### 2. Atualizar Lógica de Contagem

Substituir a contagem atual de `contrato_pago` que usa `scheduled_at` pela nova lógica que usa `contract_paid_at`:

```typescript
// Antes (conta por scheduled_at)
if (status === 'contract_paid') {
  metric!.contrato_pago++;
}

// Depois (conta por contract_paid_at no período)
// Mover para nova lógica baseada em contractsByPaymentDate
```

### 3. Contar por Data de Pagamento por Closer

```typescript
// Mapear contratos pagos no período por closer
const contractsByCloser = new Map<string, number>();
contractsByPaymentDate?.forEach(att => {
  const closerId = att.meeting_slot?.closer_id;
  if (closerId) {
    // Validar se booked_by é SDR válido
    const bookedByEmail = att.booked_by ? profileEmailMap.get(att.booked_by) : null;
    if (bookedByEmail && validSdrEmails.has(bookedByEmail)) {
      contractsByCloser.set(closerId, (contractsByCloser.get(closerId) || 0) + 1);
    }
  }
});

// Usar no cálculo final
contrato_pago: contractsByCloser.get(closer.id) || 0,
```

---

## Comportamento Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Reunião dia 25, pagou dia 28 | Não conta em "Hoje" | Conta em "Hoje" |
| Reunião dia 28, pagou dia 28 | Conta em "Hoje" | Conta em "Hoje" |
| Reunião dia 28, pagou dia 30 | Conta em "Hoje" (errado) | Não conta em "Hoje" |

O sistema passará a contar contratos pela **data real do pagamento**, refletindo corretamente os resultados de follow-up.

---

## Observação Importante

Alguns registros têm `contract_paid_at = NULL` mesmo com status `contract_paid`. Para manter compatibilidade:
- Se `contract_paid_at` existir → usar essa data
- Se `contract_paid_at` for NULL → fallback para `scheduled_at` (comportamento atual)

Isso garante que contratos antigos sem timestamp continuem sendo contabilizados.
