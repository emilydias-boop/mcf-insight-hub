

## Problema: Filtro de "Tentativas" não funciona para não-SDRs

### Diagnóstico

O filtro de tentativas depende do hook `useBatchDealActivitySummary` que busca ligações (`calls`) e atividades (`deal_activities`) usando `.in('deal_id', dealIds)`.

**2 problemas encontrados:**

1. **Limite de 1000 linhas do Supabase (mesmo bug corrigido antes)**: Para admins/managers, `dealIds` contém milhares de IDs. A query de `calls` retorna no máximo 1000 registros, truncando os dados. Muitos deals ficam com `totalCalls = 0` erroneamente, e o filtro os exclui.

2. **Case mismatch na lookup**: O `summaryMap` armazena chaves como `id.toLowerCase().trim()` (linha 131-135), mas o filtro em `Negocios.tsx` busca com `activitySummaries.get(deal.id)` (linha 449) — sem normalizar. Se houver qualquer diferença de casing, o lookup retorna `undefined` e `totalCalls` cai para 0.

### Correção

**`src/hooks/useDealActivitySummary.ts`** (hook `useBatchDealActivitySummary`):

1. **Paginar as queries de `calls`, `deal_activities` (whatsapp), e `deal_activities` (notes)** usando o mesmo padrão `fetchAll` com `.range()` em batches de 1000, para garantir que todos os registros sejam retornados.

2. **Também fazer batch do `.in()` em grupos de 200 IDs** para evitar URLs muito longas que falham silenciosamente no PostgREST.

**`src/pages/crm/Negocios.tsx`** (linha 449):

3. **Normalizar o deal.id na lookup**: Trocar `activitySummaries.get(deal.id)` por `activitySummaries.get(deal.id.toLowerCase().trim())` — consistente com como o mapa é construído.

4. Aplicar a mesma normalização nas demais linhas (414-416, 487-489) que também usam `activitySummaries.get(deal.id)`.

