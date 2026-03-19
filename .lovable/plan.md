

## Plano: Sincronização automática de cobranças ao receber webhook da Hubla

### Problema
Hoje a atualização de cobranças só acontece quando o operador clica "Sincronizar Hubla". Quando um pagamento cai na Hubla (ex: parcela do Leo), a `billing_subscriptions` e `billing_installments` não são atualizadas automaticamente.

### Causa raiz
O `hubla-webhook-handler` insere na `hubla_transactions` mas nunca toca nas tabelas de billing. O `sync-billing-from-hubla` é uma Edge Function separada chamada apenas manualmente.

### Solução
Adicionar lógica incremental no `hubla-webhook-handler` para, após inserir a transação parcelada na `hubla_transactions`, automaticamente:
1. Verificar se já existe uma `billing_subscription` para aquele email+produto
2. Se existir: atualizar status e marcar a parcela correspondente como paga
3. Se não existir e for parcelado (total_installments > 1): criar a subscription + parcelas

Isso é feito inline no webhook, sem chamar outra Edge Function (evita latência extra).

### Mudanças

**Arquivo: `supabase/functions/hubla-webhook-handler/index.ts`**

Adicionar uma função helper `syncBillingFromTransaction()` que:
- Recebe os dados da transação recém-inserida (email, produto, parcela N, total parcelas, valor, data)
- Busca `billing_subscriptions` por `customer_email + product_name`
- Se encontra: atualiza `billing_installments` onde `numero_parcela = installment_number` marcando como pago
- Se não encontra e `total_installments > 1`: cria subscription + todas as parcelas (pagas e futuras)
- Atualiza status da subscription (quitada/em_dia/atrasada)

Chamar essa função após cada insert bem-sucedido em `hubla_transactions` dentro do bloco `invoice.payment_succeeded`.

```text
Fluxo:
  Hubla webhook → hubla-webhook-handler
    ├─ Insere em hubla_transactions (já existe)
    └─ [NOVO] syncBillingFromTransaction()
         ├─ Busca billing_subscription por email+produto
         ├─ Se existe → marca parcela como paga, recalcula status
         └─ Se não existe → cria subscription + parcelas
```

### Detalhes técnicos

A função `syncBillingFromTransaction` reutiliza a mesma lógica de `sync-billing-from-hubla` mas para uma única transação:

```typescript
async function syncBillingFromTransaction(supabase, tx: {
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  product_name: string;
  product_category: string;
  product_price: number;
  net_value: number;
  installment_number: number;
  total_installments: number;
  sale_date: string;
  transaction_id: string;
}) {
  // Só processar parcelados
  if (tx.total_installments <= 1) return;
  
  // Buscar subscription existente
  const { data: sub } = await supabase
    .from('billing_subscriptions')
    .select('id')
    .eq('customer_email', tx.customer_email.toLowerCase())
    .eq('product_name', tx.product_name)
    .maybeSingle();
  
  if (sub) {
    // Marcar parcela como paga
    await supabase
      .from('billing_installments')
      .update({ 
        status: 'pago', 
        valor_pago: tx.net_value || tx.product_price,
        data_pagamento: tx.sale_date,
        hubla_transaction_id: tx.transaction_id 
      })
      .eq('subscription_id', sub.id)
      .eq('numero_parcela', tx.installment_number);
    
    // Recalcular status da subscription
    // ...conta parcelas pagas vs total
  } else {
    // Criar subscription + parcelas (mesma lógica do sync)
  }
}
```

O botão "Sincronizar Hubla" continua existindo para reconciliação em massa / dados históricos.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/hubla-webhook-handler/index.ts` | Adicionar `syncBillingFromTransaction()` + chamá-la após insert |

