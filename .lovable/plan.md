

## Plano: Preencher "Dia Compra" faltante via hubla_transactions

### Problema
Alguns leads mostram "-" na coluna "Dia Compra" porque o campo `contract_paid_at` no attendee de R1 está NULL. Isso acontece quando o webhook de contrato não conseguiu vincular a transação ao attendee (ex: lead "outside", matching falhou, ou contrato antigo anterior ao sistema de linking).

### Solução
Após o merge com R1, fazer um fallback para leads que ainda não têm `contract_paid_at`: buscar na tabela `hubla_transactions` pelo `customer_email` do contato, filtrando por `product_name = 'A000 - Contrato'` e `sale_status in ('completed', 'refunded')`, e usar o `sale_date` como data de compra.

### Alterações

**`src/hooks/useR2CarrinhoData.ts`** (após o bloco de merge R1, ~linha 289)

1. Coletar os emails dos attendees que ainda têm `contract_paid_at` nulo
2. Buscar em `hubla_transactions` a transação mais recente para cada email
3. Popular `contract_paid_at` com `sale_date` da transação encontrada

```ts
// Após merge R1 (linha 289), antes do sort:
const missingContractEmails = merged
  .filter(a => !a.contract_paid_at && a.contact_email)
  .map(a => a.contact_email!.toLowerCase().trim());

if (missingContractEmails.length > 0) {
  const uniqueEmails = [...new Set(missingContractEmails)];
  const { data: txs } = await supabase
    .from('hubla_transactions')
    .select('customer_email, sale_date')
    .eq('product_name', 'A000 - Contrato')
    .in('sale_status', ['completed', 'refunded'])
    .in('customer_email', uniqueEmails)
    .order('sale_date', { ascending: false });

  const emailToSaleDate = new Map<string, string>();
  for (const tx of txs || []) {
    const email = (tx.customer_email || '').toLowerCase().trim();
    if (email && !emailToSaleDate.has(email)) {
      emailToSaleDate.set(email, tx.sale_date);
    }
  }

  for (const att of merged) {
    if (!att.contract_paid_at && att.contact_email) {
      const saleDate = emailToSaleDate.get(att.contact_email.toLowerCase().trim());
      if (saleDate) att.contract_paid_at = saleDate;
    }
  }
}
```

Nenhum outro arquivo precisa ser alterado.

