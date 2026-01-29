
# Correção do data_source para Webhook Lead Receiver

## Problema Identificado

O webhook `webhook-lead-receiver` não está salvando leads porque utiliza `data_source: 'webhook-${slug}'` (ex: `'webhook-lead-form-50k'`), mas a tabela `crm_deals` possui uma constraint que só aceita os valores:
- `csv`
- `webhook`
- `manual`
- `bubble`

### Impacto
Todos os leads recebidos via qualquer slug do `webhook-lead-receiver` estão falhando com o erro:
```
new row for relation "crm_deals" violates check constraint "crm_deals_data_source_check"
```

---

## Análise dos Webhooks por BU

| Webhook | Tabela alvo | data_source | Status |
|---------|-------------|-------------|--------|
| `webhook-lead-receiver` | `crm_deals` | `webhook-${slug}` ❌ | **Precisa corrigir** |
| `webhook-live-leads` | `crm_deals` | `'webhook'` ✅ | OK |
| `webhook-consorcio` | `consortium_cards` | N/A | OK (tabela diferente) |
| `webhook-leilao` | `auctions` | N/A | OK (tabela diferente) |
| `webhook-credito` | `credit_deals` | N/A | OK (tabela diferente) |
| `webhook-projetos` | `projects` | N/A | OK (tabela diferente) |

Apenas o `webhook-lead-receiver` precisa de correção.

---

## Alterações Necessárias

### Arquivo: `supabase/functions/webhook-lead-receiver/index.ts`

**Linha 153** - Criar contato:
```typescript
// ANTES:
data_source: `webhook-${slug}`

// DEPOIS:
data_source: 'webhook'
```

**Linha 243** - Criar deal:
```typescript
// ANTES:
data_source: `webhook-${slug}`,

// DEPOIS:
data_source: 'webhook',
```

---

## Rastreabilidade Mantida

A informação específica do slug continua disponível em:
- `custom_fields.source` → slug do endpoint
- `custom_fields.webhook_endpoint` → nome do endpoint
- `custom_fields.lead_channel` → slug em uppercase

Não há perda de informação para fins de analytics ou debug.

---

## Resumo

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/webhook-lead-receiver/index.ts` | Alterar `data_source` de `'webhook-${slug}'` para `'webhook'` em 2 locais (linhas 153 e 243) |

---

## Resultado Esperado

Após a correção:
1. ✅ Leads do `lead-form-50k` aparecerão no Kanban
2. ✅ Leads de qualquer outro slug configurado funcionarão
3. ✅ Todas as BUs (Consórcio, Leilão, Crédito, Projetos) poderão receber leads via `webhook-lead-receiver`
4. ✅ A rastreabilidade da origem permanece via `custom_fields`
