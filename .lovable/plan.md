

## Corrigir Falhas no Webhook ClientData Inside — 2 Bugs

### Evidências nos Logs

**Lead ANDREZA BARBOSA CSAKO**: O deal foi criado com sucesso, mas o `lead_profiles` FALHOU com erro:
```
date/time field value out of range: "18101994"
```
O campo `data_nascimento` veio como `"18101994"` (formato DDMMYYYY sem separadores) e o Postgres não conseguiu interpretar.

**Lead Jose Luiz Filho**: O deal NÃO foi criado — erro:
```
duplicate key value violates unique constraint "crm_deals_contact_origin_unique"
Key (contact_id, origin_id)=(...) already exists.
```
O check de duplicata (linhas 258-265) só verifica deals das últimas 24h, mas existe uma constraint UNIQUE em `(contact_id, origin_id)` que bloqueia quando o contato já tem um deal mais antigo na mesma pipeline.

### Bug 1: `data_nascimento` sem parsing

O campo é enviado direto ao Postgres sem normalização. Formatos como `"18101994"`, `"18/10/1994"`, `"1994-10-18"` precisam ser tratados.

**Fix em `webhook-lead-receiver/index.ts`** (~linha 498):
- Criar função `parseDateField(val)` que trata:
  - `DDMMYYYY` (8 dígitos) → `YYYY-MM-DD`
  - `DD/MM/YYYY` → `YYYY-MM-DD`
  - `YYYY-MM-DD` → já está ok
  - Valor inválido → `null` (não quebra o upsert)
- Aplicar em `data_nascimento` antes do upsert

### Bug 2: Constraint UNIQUE `(contact_id, origin_id)` conflita com check de 24h

O código verifica duplicatas apenas nas últimas 24h (linha 258), mas a constraint UNIQUE não tem limite temporal. Quando o contato já existe na pipeline (deal antigo), o INSERT falha.

**Fix em `webhook-lead-receiver/index.ts`** (~linhas 257-284):
- Alterar a verificação: buscar ANY deal existente para `(contact_id, origin_id)` sem filtro de 24h
- Se encontrar deal existente: atualizar o `lead_profile` e retornar `updated_profile` (comportamento atual)
- Se o deal existente for antigo (>24h), opcionalmente atualizar tags/custom_fields do deal existente

### Arquivos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/webhook-lead-receiver/index.ts` | Adicionar `parseDateField()` para normalizar datas; remover filtro de 24h na verificação de duplicatas |

