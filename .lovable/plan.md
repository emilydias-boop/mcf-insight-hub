

## Problema: `contract_paid_at` usa data de hoje em vez da data real da venda

### Diagnóstico

No `useLinkContractToAttendee.ts` (linha 63), ao vincular um contrato:

```typescript
contract_paid_at: new Date().toISOString()  // ← usa "agora"
```

Deveria usar o `sale_date` da transação Hubla. O William Lima teve reunião em 05/03, a transação Hubla tem `sale_date` da semana passada, mas ao vincular hoje (11/03) o `contract_paid_at` ficou como 11/03, fazendo o contrato aparecer no dia de hoje em vez do dia correto.

A memória do projeto confirma: *"contract_paid_at deve refletir obrigatoriamente a data real da transação (sale_date) da Hubla"*.

### Correção

**Arquivo: `src/hooks/useLinkContractToAttendee.ts`**

1. Antes de atualizar o attendee, buscar o `sale_date` da transação Hubla pelo `transactionId`
2. Usar `sale_date` como valor de `contract_paid_at` (com fallback para `new Date()` caso não exista)

```typescript
// Buscar sale_date da transação
const { data: txData } = await supabase
  .from('hubla_transactions')
  .select('sale_date')
  .eq('id', transactionId)
  .maybeSingle();

const contractPaidAt = txData?.sale_date || new Date().toISOString();

// Atualizar attendee com a data correta
.update({ 
  status: 'contract_paid',
  contract_paid_at: contractPaidAt
})
```

Alteração de ~5 linhas em um único arquivo. Não afeta contratos já vinculados (para corrigir dados históricos seria necessário um script SQL separado).

