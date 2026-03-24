
## Contexto

O webhook atual `clientdata-inside` tem:
- **slug**: `clientdata-inside`
- **auto_tags**: `["ANAMNESE"]`
- **origin_id**: `e3c04f21-ba2c-4c66-84f8-b4341c826b1c` (PIPELINE INSIDE SALES)
- **stage_id**: `d346320a-00b0-4e9f-89b6-149ad1c34061`
- **field_mapping**: mapeamento completo de anamnese (nome, telefone, faixa aporte, etc.)

O usuário quer **dois novos webhooks independentes** — não replicas do mesmo, mas fontes distintas com tags distintas:

---

## O que criar

### Webhook 1 — Anamnese MCF (fonte principal, réplica do clientdata-inside)
- **slug**: `anamnese-mcf`
- **name**: `Anamnese MCF`
- **auto_tags**: `["ANAMNESE"]`
- **origin_id**: `e3c04f21-ba2c-4c66-84f8-b4341c826b1c`
- **stage_id**: `d346320a-00b0-4e9f-89b6-149ad1c34061`
- **field_mapping**: idêntico ao `clientdata-inside`
- **description**: `Webhook de anamnese MCF (fonte principal)`

**URL**: `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/webhook-lead-receiver/anamnese-mcf`

### Webhook 2 — Anamnese Instagram MCF (fonte Instagram)
- **slug**: `anamnese-insta-mcf`
- **name**: `Anamnese Instagram MCF`
- **auto_tags**: `["ANAMNESE-INSTA"]`
- **origin_id**: `e3c04f21-ba2c-4c66-84f8-b4341c826b1c`
- **stage_id**: `d346320a-00b0-4e9f-89b6-149ad1c34061`
- **field_mapping**: idêntico ao `clientdata-inside`
- **description**: `Webhook de anamnese via Instagram MCF`

**URL**: `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/webhook-lead-receiver/anamnese-insta-mcf`

---

## Como será feito

Inserção direta nas duas linhas na tabela `webhook_endpoints` via ferramenta de dados. Nenhum código de aplicação precisa ser alterado — a Edge Function `webhook-lead-receiver` já lê o `slug` da URL e aplica as `auto_tags` configuradas na linha.

---

## O que NÃO muda
- O webhook `clientdata-inside` original continua intacto com sua tag `ANAMNESE`
- A Edge Function não precisa de alteração
- Nenhum arquivo de código do app precisa ser alterado

---

## Resultado

| Webhook | Slug | Tag | URL |
|---------|------|-----|-----|
| Existente | `clientdata-inside` | `ANAMNESE` | `.../clientdata-inside` |
| Novo 1 | `anamnese-mcf` | `ANAMNESE` | `.../anamnese-mcf` |
| Novo 2 | `anamnese-insta-mcf` | `ANAMNESE-INSTA` | `.../anamnese-insta-mcf` |
