## Diagnóstico

O endpoint **A017 - Construir Para Alugar** (slug `a017-construir-para-alugar`) recebe payload da **Hubla** no `webhook-lead-receiver`. A Hubla envia estrutura aninhada:

```
{ type, event: { user: { email, firstName, lastName, phone, document }, invoice: {...} } }
```

O `webhook-lead-receiver` só faz mapeamento **flat** (`payload[source] → payload[target]`) e exige `name` e `email` no root. Como o endpoint A017 tem `field_mapping: {}` e a Hubla nunca manda esses campos no root, **toda chamada falha com 400** "Campos obrigatórios: name, email".

Confirmado: **70 chamadas Hubla em 30 dias, 0 leads criados**.

Como A017 é **infoproduto novo** (não é parceria/renovação A001-A009), o lead deve ser criado normalmente na **PIPELINE INSIDE SALES** — exatamente o que o endpoint já está configurado para fazer (`origin_id` Inside Sales, `stage_id` Novo Lead, `auto_tags: [A017]`).

## Solução

Adicionar **detecção e normalização automática de payload Hubla** no `webhook-lead-receiver`, ativada apenas quando o request vier da Hubla.

### Mudança única

**Arquivo:** `supabase/functions/webhook-lead-receiver/index.ts`

Inserir, logo antes do bloco "4. Apply reverse field mapping" (~linha 138), uma normalização:

1. Detecta Hubla via `req.headers.get('x-hubla-token')` **ou** `payload.event?.user`.
2. Mescla no root **sem sobrescrever** valores já existentes:
   - `email` ← `payload.event.user.email`
   - `name` ← `${firstName} ${lastName}` (trim, fallback firstName)
   - `phone` ← `payload.event.user.phone`
   - `document` ← `payload.event.user.document` (útil para dedupe por CPF)
   - `product_name` ← `payload.event.product?.name` (se existir)
   - `hubla_event_type` ← `payload.type`
3. Loga `[WEBHOOK-RECEIVER] Hubla payload normalizado: { email, name, phone }`.

O resto do fluxo continua igual — validação de `required_fields`, partner check, criação de contact/deal, distribuição, auto-tags.

### Por que essa abordagem

- **Cirúrgica**: só ativa quando detecta Hubla. Não toca Make, Manychat, Alfredo, Anamnese.
- **Não-destrutiva**: se a fonte algum dia mandar `name`/`email` no root, esses valores prevalecem.
- **Cobre futuros endpoints Hubla**: qualquer novo infoproduto Hubla apontado para `/webhook-lead-receiver/<slug>` funciona sem configurar `field_mapping` manualmente.

### Memória a salvar após implementação

Nova memória em `mem://integration/webhook-lead-receiver-hubla-normalization` — descrever que `webhook-lead-receiver` normaliza automaticamente payloads Hubla (`event.user.*` → root), para que futuros endpoints Hubla (infoprodutos novos) não precisem de field_mapping manual.

### Validação pós-deploy

1. Logs da próxima chamada Hubla A017: aparecer `Hubla payload normalizado` e responder 200.
2. `webhook_endpoints.leads_received` do A017 incrementando.
3. Lead aparecendo na PIPELINE INSIDE SALES, stage Novo Lead, com tag `A017`.
