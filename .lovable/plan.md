## Problema

O `kiwify-webhook-handler` recebe a compra aprovada e grava em `hubla_transactions` / `a010_sales`, mas **nunca cria o deal no CRM**. Por isso a Inês Cordeiro (e qualquer compra A010 vinda do Kiwify) não aparece em "Novo Lead" da PIPELINE INSIDE SALES.

Toda a lógica de criar/atualizar contato + deal A010 (origem canônica `PIPELINE INSIDE SALES`, stage `Novo Lead`, tags, custom fields `a010_compra/a010_produto/a010_data`, bloqueio de parceiros via `partner_returns`, herança de owner, promoção de "A010 Em Aberto" → "Novo Lead", dedupe por email/telefone) vive apenas no `hubla-webhook-handler` e usa por padrão `tags: ['A010', 'Hubla']`.

## Mudanças

### 1. `supabase/functions/kiwify-webhook-handler/index.ts`
Portar para dentro do handler do Kiwify as funções necessárias do Hubla, mantendo o mesmo comportamento, mas com tag de origem trocada:

- `normalizePhone`
- `checkIfPartner` (bloqueio de parceiros A001/A002/A003/A004/A009/Incorporador/Anticrise — registra em `partner_returns` com `return_source: 'kiwify_a010'`)
- `createOrUpdateCRMContact` — versão Kiwify:
  - `originName` fixo = `PIPELINE INSIDE SALES`
  - `targetStageName` = `'Novo Lead'`
  - `extraTags` default = `['A010', 'A010 Kiwify']` (substitui o `'Hubla'` por `'A010 Kiwify'` conforme pedido)
  - Mesma lógica de dedupe (email lower + sufixo 9 dígitos do telefone), atualização de tags sem duplicar, promoção de stage "A010 Em Aberto" → "Novo Lead", custom_fields `a010_compra=true`, `a010_produto`, `a010_data`, herança de owner do deal mais recente do contato.

### 2. Disparo dentro do bloco `order_approved` (após inserir a transação)
Quando `productCategory === 'a010'` e `installmentNumber === 1`, chamar `createOrUpdateCRMContact` com:
```ts
{
  email: customerEmail,
  phone: customerPhone,
  name: customerName,
  originName: 'PIPELINE INSIDE SALES',
  productName,
  value: grossValue,
  extraTags: ['A010', 'A010 Kiwify'],
}
```
Erros no CRM são logados mas **não derrubam** a resposta 200 (o webhook ainda confirma para a Kiwify).

### 3. Refund (`order_refunded`)
Sem mudança no CRM por enquanto — apenas marca `hubla_transactions.sale_status='refunded'` (idêntico ao comportamento atual da Hubla para A010).

## Validação

1. Após deploy, reenviar pelo painel da Kiwify o evento `order_approved` do pedido `6d33f782` (Inês Cordeiro).
2. Conferir nos logs: `[CRM] Deal criado: Inês Cordeiro - A010 (...)`.
3. Conferir em `crm_deals` que existe deal com `origin_id` = PIPELINE INSIDE SALES, `stage_name='Novo Lead'`, `tags @> ['A010','A010 Kiwify']`.
4. Confirmar com você antes de desativar o endpoint duplicado `webhook-lead-receiver/a010-kiwify` na Kiwify.

## Fora do escopo

- Refatorar `createOrUpdateCRMContact` para módulo compartilhado entre Hubla/Kiwify (duplicação aceita agora para não tocar no Hubla, que está estável).
- Mudar a tag dos leads Hubla existentes.