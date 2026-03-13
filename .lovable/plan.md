

## Fix: A010 com Order Bump não cria lead no CRM (invoice.payment_succeeded)

### Problema
No bloco `invoice.payment_succeeded` com items (linha 1671-1811), quando o order bump vem no slot 0 e o A010 vem no slot 1:
- `isOffer = i > 0` → A010 fica com `isOffer = true`
- O check na linha 1753 (`productCategory === 'a010' && !isOffer`) **falha**
- Resultado: nenhum lead é criado no CRM

O `NewSale` **não** deve criar lead — é apenas intenção de compra. A criação de lead deve acontecer apenas no `invoice.payment_succeeded`.

### Solução

**Arquivo: `supabase/functions/hubla-webhook-handler/index.ts`**

**Após o loop de items** (depois da linha 1811, antes do `}`), adicionar um scan pós-loop que verifica se algum item A010 ficou como `isOffer=true` e não criou lead:

```typescript
// Pós-loop: Se algum item A010 ficou como offer e não criou lead, criar agora
if (installment === 1) {
  const a010ItemIndex = items.findIndex((item: any, idx: number) => {
    const name = item.product?.name || item.offer?.name || item.name || '';
    const code = item.product?.code || item.product_code || null;
    return idx > 0 && mapProductCategory(name, code) === 'a010';
  });

  if (a010ItemIndex >= 0) {
    const a010Item = items[a010ItemIndex];
    const a010Name = a010Item.product?.name || a010Item.offer?.name || a010Item.name || 'A010';
    const a010Price = parseFloat(a010Item.price || a010Item.amount || 0);
    const payer = invoice?.payer || {};
    const user = body.event?.user || {};
    const customerEmail = payer.email || user.email || null;
    const customerPhone = payer.phone || user.phone || null;
    const customerName = `${payer.firstName || ''} ${payer.lastName || ''}`.trim() || user.name || null;
    const saleDate = new Date(invoice.saleDate || invoice.created_at || invoice.createdAt || Date.now()).toISOString();

    console.log(`🔄 [A010 como offer] Detectado no slot ${a010ItemIndex}, criando lead...`);

    // a010_sales
    await supabase.from('a010_sales').upsert({
      customer_name: customerName || 'Cliente Desconhecido',
      customer_email: customerEmail,
      customer_phone: customerPhone,
      net_value: a010Price,
      sale_date: saleDate,
      status: 'completed',
    }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });

    // CRM contact + deal
    await createOrUpdateCRMContact(supabase, {
      email: customerEmail,
      phone: customerPhone,
      name: customerName,
      originName: 'A010 Hubla',
      productName: a010Name,
      value: a010Price,
    });
  }
}
```

### Escopo
- Apenas `supabase/functions/hubla-webhook-handler/index.ts`
- Bloco `invoice.payment_succeeded` com items — pós-loop (após linha 1811)
- Deploy automático da edge function

