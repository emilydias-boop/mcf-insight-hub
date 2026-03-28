

## Fix: Toda a classificação de Canal falha porque a query de deals retorna erro 400

### Causa raiz

A query de deals (linha 451) usa:
```
owner:profiles!crm_deals_owner_profile_id_fkey(name)
```
Mas a tabela `profiles` tem `full_name`, não `name`. Isso causa **HTTP 400** em TODAS as execuções, fazendo `dealsResult.data` retornar `null`. O `dealMap` fica vazio. Resultado: TODA classificação de canal (ANAMNESE, LANÇAMENTO, OUTSIDE, etc.) falha porque depende de dados do deal.

O mesmo erro aparece na segunda query de deals para phone fallback (linha 579-580).

### Correção

**`src/hooks/useCarrinhoAnalysisReport.ts`** — 2 linhas:

1. **Linha 451**: Trocar `(name)` por `(full_name)` no select da query de deals
2. **Linha 580**: Mesma correção na query de deals do phone fallback

```typescript
// De:
owner:profiles!crm_deals_owner_profile_id_fkey(name)
// Para:
owner:profiles!crm_deals_owner_profile_id_fkey(full_name)
```

E ajustar `mergeDealsIntoMap` (linha 218) que lê `d.owner?.name`:
```typescript
// De:
const sdrName = (d as any).owner?.name || null;
// Para:
const sdrName = (d as any).owner?.full_name || null;
```

### Impacto
Corrige de uma vez: ANAMNESE, OUTSIDE, LANÇAMENTO, A010, BASE CLINT — tudo que depende de tags/origin/channel do deal.

### Arquivo alterado
- `src/hooks/useCarrinhoAnalysisReport.ts` (3 pontos)

