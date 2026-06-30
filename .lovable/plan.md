## Diagnóstico

✅ Assinatura HMAC agora valida (segredos sincronizados, fingerprint `38fe8923` dos dois lados).

❌ Novo erro: `deal_not_found`. O `deal_id` recebido (`7f293b67-e941-4f07-ab65-c41a921c67c2`) é o `invoice.id` do MCF Pay, não o UUID do deal no CRM. Confirmei via `SELECT` em `crm_deals` — esse UUID não existe lá.

## Causa

No envio outbound do CRM (`notify-mcf-pay`), mandamos o `crm_deals.id` como referência. O MCF Pay deveria persistir esse valor junto da invoice e devolver no callback de pagamento. Em vez disso, está devolvendo o próprio `invoice.id`.

## Plano

**Lado MCF Pay (correção principal — você precisa pedir lá):**

Cole esta mensagem no chat do projeto MCF Pay no Lovable:

> No callback `payment.confirmed` enviado pro CRM, o campo `data.deal_id` está vindo com o `invoice.id` do MCF Pay (ex.: `7f293b67-...`), mas tem que ser o **UUID do deal no CRM** que veio no webhook outbound do CRM (campo `deal_id` do payload `deal.won`).
>
> Ajuste:
> 1. Quando o CRM envia o webhook `deal.won`, persista o `deal_id` recebido na invoice/transação correspondente (coluna `crm_deal_id` ou metadata).
> 2. No callback `payment.confirmed` pro CRM, mande esse `crm_deal_id` salvo no campo `data.deal_id` — não o `invoice.id`.
> 3. Reenvie o webhook da invoice `7f293b67-e941-4f07-ab65-c41a921c67c2` (e das outras 2 pendentes) com o `deal_id` correto.

**Lado CRM (defesa em profundidade — opcional, eu faço se aprovar):**

Como fallback, adicionar lookup secundário em `mcf-pay-callback`: se `deal_id` não existir em `crm_deals`, tentar localizar por `data.transaction_id` em `crm_deals.custom_fields.mcf_pay_transaction_id` (campo que já populamos no callback bem-sucedido). Não resolve o caso atual (transaction_id `pay_348fwsh5ngpkxypn` ainda não está em nenhum deal porque o primeiro callback nunca completou), mas previne race conditions futuras.

**Investigação extra:**

Verificar nos logs do `notify-mcf-pay` qual `deal_id` foi enviado pro MCF Pay quando o deal `7f293b67` foi marcado como ganho — assim você tem o UUID correto pra dar pro MCF Pay reconciliar manualmente as 3 invoices pendentes.

## Próximo passo

Aprova eu (a) buscar nos logs de outbound o `deal_id` correto que foi enviado pra essa transação, e (b) adicionar o fallback por `transaction_id` no callback?
