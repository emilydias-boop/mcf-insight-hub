

## Fix: "Nenhuma movimentação encontrada" no dashboard de Movimentações

### Causa raiz

O hook `useStageMovements` busca até 5000 atividades de `stage_change` no período e depois faz **uma única** chamada `crm_deals.select().in('id', [...5000 ids])`. A URL resultante passa de 4000 caracteres e o PostgREST devolve **HTTP 400 Bad Request**. Resultado: `deals = []`, `dealMap` vazio, tela vazia.

Mesmo problema atinge `crm_origins.in('id', ...)` quando há muitas origens distintas.

### Correção

Paginar as queries `IN(...)` em lotes de 200 IDs (padrão já usado em `useDealActivitySummary.ts`), juntar os resultados em memória. Mantém o teto de 5000 atividades + adiciona log de diagnóstico no console pra você validar os números.

### Mudanças

**Arquivo único:** `src/hooks/useStageMovements.ts`

1. Helper interno `chunk<T>(arr: T[], size = 200): T[][]`
2. Substituir a query única de `crm_deals` por `Promise.all` sobre chunks:
   ```ts
   const dealChunks = chunk(dealIds, 200);
   const dealsResults = await Promise.all(
     dealChunks.map(async (ids) => {
       let q = supabase.from('crm_deals')
         .select('id, name, tags, origin_id')
         .in('id', ids);
       if (originIds && originIds.length > 0) q = q.in('origin_id', originIds);
       const { data, error } = await q;
       if (error) throw error;
       return data || [];
     })
   );
   const deals = dealsResults.flat();
   ```
3. Mesmo tratamento em `crm_origins.in('id', originIdsFromDeals)` (chunks de 200).
4. Manter `.limit(5000)` em `deal_activities`. Adicionar `console.info('[useStageMovements]', { activities, dealsAfterFilter, rows })` para validação.

### Garantias sobre o resultado

- **Não muda contagens**: mesma lógica de agregação, mesmos filtros (período, pipeline, tag atual).
- **Não duplica linhas**: cada chunk traz IDs disjuntos; `flat()` apenas concatena.
- **Não inflaciona "leads únicos"**: `Set<deal.id>` deduplica por natureza.
- **Limitação de tag** documentada no plano original permanece (tag atual, não histórica).

### Validação

1. Abrir `/crm/movimentacoes` com range padrão (últimos 30 dias)
2. Network: várias chamadas `crm_deals?id=in.(...)` retornando **200** em vez de uma única **400**
3. Console mostra `[useStageMovements] { activities: N, dealsAfterFilter: M, rows: K }`
4. Tabela "Resumo por estágio" populada; detalhe lista os leads
5. Filtrar por pipeline e por tag → contagens reagem
6. Clicar num estágio do resumo → detalhe filtra
7. Range curto (1 dia) e range longo (30 dias) ambos funcionam

### Escopo

- 1 arquivo editado, zero migrations, zero RLS, zero mudança de UI
- Reaproveita o padrão já existente em `useDealActivitySummary.ts`

