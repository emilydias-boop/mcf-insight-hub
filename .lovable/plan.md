

## Problema Encontrado

A taxa de conversão individual está **incorreta** porque Outside infla o denominador sem adicionar ao numerador:

- `r1_realizada` conta attendees com status `contract_paid` (inclui Outside)
- `contrato_pago` **exclui** Outside (contrato pago antes da reunião)

**Resultado**: Um closer com 10 realizadas, 3 contratos e 2 Outside mostra 30% (3/10), quando deveria mostrar 37.5% (3/8) — já que as 2 Outside não foram convertidas "depois da reunião".

## Solução

Excluir Outside do `r1_realizada` no hook `useR1CloserMetrics.ts`.

### Alteração em `src/hooks/useR1CloserMetrics.ts`

Na seção que conta `r1_realizada` (linhas 435-436), precisamos verificar se o attendee é Outside antes de contar como realizada:

1. Construir um Set de attendee IDs que são Outside (usando `contractsByPaymentDate` onde `contract_paid_at < scheduled_at`)
2. No loop de contagem (linha 435), só contar como `r1_realizada` se o attendee **não** for Outside

Ou alternativamente, mover a detecção para dentro do loop de meetings: se status é `contract_paid`, verificar o `contract_paid_at` contra `scheduled_at` do slot. Se Outside, não contar em `r1_realizada`.

**Problema**: No loop atual (linha 419), os attendees não têm `contract_paid_at` no select. Precisamos adicioná-lo ao select da query de meetings (linha 82-88).

### Mudanças concretas:

1. **Query de meetings** (linha 77-93): Adicionar `contract_paid_at` ao select dos `meeting_slot_attendees`
2. **Loop de contagem** (linhas 435-436): Antes de incrementar `r1_realizada`, checar se é Outside:
   ```
   if (status === 'contract_paid') {
     // Verificar se é Outside
     const isOutside = att.contract_paid_at && new Date(att.contract_paid_at) < new Date(meeting.scheduled_at);
     if (!isOutside) {
       metric.r1_realizada++;
     }
   } else if (status === 'completed') {
     metric.r1_realizada++;
   }
   ```

3. **CloserSummaryTable.tsx** e **CloserDetailKPICards.tsx**: Sem alteração — a fórmula `contrato_pago / r1_realizada` já está correta, o problema era nos dados.

### Resultado

A taxa de conversão refletirá: "das reuniões que o closer realmente fez (excluindo Outside), quantas converteram depois da reunião".

