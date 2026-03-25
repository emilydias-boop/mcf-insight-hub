

## Diagnóstico: Leads duplicados no Kanban

### Causa raiz

O "Pedro Paulo Lourenço Brandão" aparece 2x na pipeline **Pipeline de Vendas** porque existem 2 deals distintos para o mesmo contato e mesma origin:

1. `8732f0db` — criado via **webhook Make/A010** às 11:11 (com owner distribuído)
2. `79663c2b` — criado via **importação CSV** às 11:15 (sem owner)

O CSV import (`process-csv-imports`) verifica duplicatas **apenas dentro do próprio CSV** (via `processedContactOrigins`), mas **não consulta deals já existentes no banco**. Como cada deal recebe um `clint_id` aleatório, a RPC `upsert_deals_smart` também não detecta conflito (`ON CONFLICT (clint_id)`).

Este é um problema sistêmico — qualquer lead que chega via webhook/Clint antes de um CSV ser processado será duplicado. A query confirmou que há pelo menos 4 contatos com deals duplicados na mesma pipeline.

---

### Plano de correção (2 partes)

#### Parte 1 — Prevenir novas duplicatas no CSV import

**Arquivo:** `supabase/functions/process-csv-imports/index.ts`

Antes do loop principal de deals (linha ~185), carregar todos os deals existentes para a `origin_id` do job:

```
SELECT contact_id FROM crm_deals WHERE origin_id = $originId AND contact_id IS NOT NULL
```

Armazenar em um `Set<string>`. Dentro do loop, após resolver o `contactId`, verificar se já existe um deal para aquele contato na origin. Se existir, pular (incrementar `chunkSkipped`) em vez de criar um novo deal.

#### Parte 2 — Limpar os duplicados existentes

Criar uma query que identifica deals duplicados (mesmo `contact_id` + `origin_id`, mais de 1 deal) e deletar o deal com menor informação (sem owner, sem reuniões, criado por CSV), preservando o deal principal (com owner, criado por webhook, com mais histórico).

Isso pode ser feito via:
- Executar a ferramenta de **Consolidação de Deals** já existente na página de Contatos Duplicados, ou
- Um script pontual que remove os deals CSV órfãos identificados.

---

### Detalhes técnicos

| Item | Detalhe |
|------|---------|
| Arquivo modificado | `supabase/functions/process-csv-imports/index.ts` |
| Lógica | Carregar `existingDealContacts` Set antes do loop; skip se `contactId` já está no Set |
| Deploy | Edge Function precisa ser redeployada |
| Limpeza | Deletar deal `79663c2b` (CSV, sem owner) mantendo `8732f0db` (webhook, com owner) |
| Escopo | ~4 contatos afetados na pipeline atual |

