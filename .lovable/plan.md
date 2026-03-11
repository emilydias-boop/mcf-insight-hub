

## Problema Identificado

O webhook do **mcfpay** envia payload no **formato Hubla**, não no formato Asaas:

```text
Formato mcfpay (Hubla):
{
  "type": "invoice.payment_succeeded",   ← tipo do evento aqui
  "event": { user, invoice, product },   ← dados do evento aqui (OBJETO)
  "version": "1.0.0"
}

Formato que o handler espera:
{
  "event": "purchase.completed",          ← tipo como STRING
  "payment": { ... }                      ← ou "data": { ... }
}
```

Na linha 333 do `asaas-webhook-handler`, o handler faz `const event = body.event` que retorna o **objeto inteiro** (user, invoice, product) em vez de uma string. Depois na linha 352, `validEvents.includes(event)` falha porque `event` é um objeto, não uma string. Resultado: **todas as vendas do mcfpay estão sendo marcadas como "skipped"**.

Confirmação: **9 webhooks em março, todos com status "skipped"**.

A transação do Samuel Barbosa que aparece no banco (criada em 2026-03-11 15:06:51) veio do `webhook-make-parceria` (source: 'make'), **não** do mcfpay. O mcfpay não está criando nenhuma transação.

## Solução

Modificar o `asaas-webhook-handler` para detectar o formato Hubla/mcfpay e extrair os dados corretamente:

### `supabase/functions/asaas-webhook-handler/index.ts`

**1. Extrair evento corretamente (linha 333)**
```typescript
// Detectar formato: Hubla usa body.type, Asaas usa body.event como string
const event = typeof body.event === 'string' 
  ? body.event 
  : body.type || 'unknown';
```

**2. Adicionar `invoice.payment_succeeded` aos eventos válidos (linha 351)**
```typescript
const validEvents = [
  'PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 
  'purchase.completed', 'invoice.payment_succeeded'
];
```

**3. Adicionar extração do formato Hubla/mcfpay (após linha 411)**
Novo bloco `else if (body.event && typeof body.event === 'object')` para extrair dados do formato Hubla:
- `body.event.invoice` → valores, data, parcelas
- `body.event.user` ou `body.event.invoice.payer` → nome, email, telefone
- `body.event.product.name` → nome do produto
- `body.event.invoice.receivers` → net value (seller totalCents / 100)

**4. Atualizar source para 'mcfpay'** quando o formato Hubla é detectado, para diferenciar da source 'asaas'.

**5. Deploy e reprocessar** os 9 webhooks skipped de março.

