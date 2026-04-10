

# Fix: Leads com produtos não-parceria sendo excluídos dos Acumulados

## Problema
O lead "João Marcos zenni" (joaozenni@gmail.com) tem status "Próxima Semana" na R2 de 30/03, mas não aparece nos Acumulados. Motivo: ele comprou o produto **A010 - Consultoria Construa para Vender sem Dinheiro** e o código atual exclui QUALQUER lead que tenha uma transação com produto diferente de "A000 - Contrato". Isso é errado — só deveria excluir quem comprou produtos de **parceria/incorporador** (A001, A002, A003, A004, A009, Anticrise, Incorporador).

## Correção

**Arquivo:** `src/hooks/useR2AccumulatedLeads.ts` (linhas 111-124)

Substituir a query genérica de "non-contract transactions" por um filtro específico de produtos de parceria, igual ao padrão já usado em `useOutsideDetectionForDeals.ts`:

```typescript
// Antes (errado): exclui qualquer produto que não seja A000/Contrato
const { data: nonContractTx } = await supabase
  .from('hubla_transactions')
  .select('customer_email, product_name')
  .in('customer_email', emails)
  .eq('sale_status', 'completed');

// Depois (correto): exclui apenas produtos de parceria/incorporador
const { data: partnerTx } = await supabase
  .from('hubla_transactions')
  .select('customer_email, product_name')
  .in('customer_email', allEmailVariants)
  .eq('sale_status', 'completed')
  .or('product_name.ilike.%A001%,product_name.ilike.%A002%,product_name.ilike.%A003%,product_name.ilike.%A004%,product_name.ilike.%A009%,product_name.ilike.%INCORPORADOR%,product_name.ilike.%ANTICRISE%');
```

E simplificar o loop de resolvedEmails para apenas adicionar os e-mails encontrados (sem precisar filtrar por product_name novamente).

Também remover o bloco morto das linhas 95-108 (partnershipTx que não faz nada).

