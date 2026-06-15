# Tag/stage por offer do checkout Hubla (A010 vs A017)

## Diagnóstico

A "compra primária" da Hubla é o produto vinculado ao **checkout que o cliente acessou primeiro**. Esse offer ID aparece em `event.invoice.paymentSession.url` (`https://pay.hub.la/<offerId>?...`). Confirmado nos 7 deals atuais: todos têm checkout URL começando com `sSUhrvi36mbjRN8gOwhs` (Construir Para Alugar VSL) → A017 é primária para todos.

Hoje o webhook cria/promove o deal usando o nome da oferta da sub-invoice ("PRINCIPAL - A010"), por isso esses deals ficaram com `product_name`/tag A010 mesmo entrando pelo funil A017.

## Mudanças

### 1. Migração retroativa (insert tool — UPDATE)

Promover os 7 deals para A017 (mantendo na stage atual `A017 - Novo Lead`):

```text
UPDATE crm_deals
SET product_name='A017 - Construir Para Alugar',
    name=replace(name,' - A010',' - A017'),
    tags=ARRAY['A017','Hubla','A010'] || ARRAY(SELECT unnest(tags) EXCEPT SELECT unnest(ARRAY['A017','Hubla','A010'])),
    updated_at=now()
WHERE id IN (
  '93c95108-13a4-470a-a5bf-46ef930802f7',  -- Helenilse
  '676c40ea-b656-481e-b0a3-6fb616794ea3',  -- Clesio
  '7d6b9f5a-f7e2-4202-91c5-a42f84cfa677',  -- Silvio
  '4c980fbe-7eb5-49a8-8a07-2f96b5bf0518',  -- Roberto Filho
  '6c1bf192-2459-4f77-911a-b2747c7ec243',  -- José Ilson
  '1030ffea-b24d-40ca-9c79-40e32d8f33d9',  -- Marcos Lopes
  'a7dc07f5-3124-4ad2-9fd9-bba06f4f6260'   -- Alexssandro
);
```

A tag `A010` fica como secundária (registra o bundle); A017 vira primária; produto e nome refletem A017; stage permanece em `8a0b84d0-...` (A017 – Novo Lead).

### 2. Webhook (`supabase/functions/hubla-webhook-handler/index.ts`)

Novo helper `getCheckoutOfferIdFromInvoice(body)`:
- Lê `event.invoice.paymentSession.url`, extrai o segmento entre `pay.hub.la/` e `?` (ou fim) → offer do checkout.
- Fallback: se `paymentSession.url` ausente, usa `event.invoice.id` removendo o sufixo `-offer-N` para achar o pai e procurar a sub-invoice cujo `offer_id` está na URL armazenada.

Novo helper `getPrimaryProductFromCheckout(body)`:
- Se offer do checkout = `sSUhrvi36mbjRN8gOwhs` → `'A017'`
- Se offer do checkout = `Rj0oC8BRxMCTJ1UZRpJ3` → `'A010'`
- caso contrário → `'OTHER'`

Aplicar em `createA017Deal` e no caminho A010:

a) Offer A017 chega e primário = A017:
   - Se já existe deal do contato em Inside Sales com `product_name ILIKE 'A010 -%'`, **promover**: troca product_name → `'A017 - Construir Para Alugar'`, renomeia `... - A010` → `... - A017`, reordena tags com A017 primária, move stage para `A017_STAGE_ID`.
   - Senão, cria deal A017 novo (comportamento atual).

b) Offer A010 chega e primário = A017:
   - Não cria deal A010 separado. Adiciona apenas a tag secundária `A010` no deal A017 (promovido ou existente).

c) Offer A017 chega e primário = A010:
   - Não cria/promove deal A017. Adiciona apenas a tag secundária `A017` no deal A010 existente; não muda stage nem produto.

d) Offer A010 chega e primário = A010: comportamento atual (deal A010 em `A010 Em Aberto`).

e) Vendas single (sem o outro produto): comportamento atual de cada caminho.

### 3. Memória do projeto

Salvar em `mem://business-logic/hubla-checkout-offer-primary-rule.md`:

> A "compra primária" em checkouts Hubla com múltiplas ofertas é determinada pelo offer ID extraído de `event.invoice.paymentSession.url` (segmento após `pay.hub.la/`). Esse offer define `product_name`, `name`, tag primária e stage do deal. Sub-invoices (`-offer-N`) com outros produtos viram apenas tags secundárias; nunca movem stage nem sobrescrevem produto principal. Mapeamento: `sSUhrvi36mbjRN8gOwhs` → A017 (Construir Para Alugar); `Rj0oC8BRxMCTJ1UZRpJ3` → A010.

## Resultado esperado

- Os 7 deals exibem badge **A017**, nome `<Cliente> - A017`, `product_name` `A017 - Construir Para Alugar`, tag secundária `A010` preservada.
- Vendas futuras: quem entra pela VSL A017 fica com tag/stage A017 mesmo que a Hubla emita uma sub-invoice A010; quem entra pelo checkout A010 fica com tag/stage A010 mesmo que pegue A017 como orderbump.
- Funil/relatórios não mudam (`useChannelFunnelReport` segue `isA017Buyer` por hubla_transactions).

## Detalhes técnicos

- Offer ID A017 VSL (checkout): `sSUhrvi36mbjRN8gOwhs`
- Offer ID A010 PRINCIPAL (checkout): `Rj0oC8BRxMCTJ1UZRpJ3`
- Stage A017 Novo Lead: `8a0b84d0-7b7a-479a-8c8e-e1067f1a3fda`
- Stage A010 Em Aberto: `698ad6b1-6ea2-4beb-8f88-7b21eeee4cc4`
- Origin Inside Sales: `e3c04f21-89a4-461b-a4c4-9ec24a59b478`
