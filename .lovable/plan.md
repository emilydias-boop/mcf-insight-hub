

## Problema: Contatos não são filtrados por BU ativa

### Causa raiz

O hook `useContactsEnriched` e a página `Contatos.tsx` **não filtram por Business Unit**. A query busca **todos os contatos** do banco e usa o `latestDeal` (deal mais recente por `created_at`) para exibir etapa, SDR, pipeline, etc.

No caso do "Felipe Antonio de Souza":
- Deal 1: Pipeline Inside Sales (Incorporador) — criado 28/03
- Deal 2: Efeito Alavanca + Clube (Consórcio) — criado 30/03 (mais recente)

Como o `latestDeal` é o mais recente, ao abrir Contatos na BU Incorporador, o contato aparece com dados do Consórcio (pipeline "Efeito Alavanca + Clube", etapa "Parceiros", SDR "Cleiton").

### Solução

Filtrar os deals do contato pela BU ativa antes de selecionar o `latestDeal`. Assim, na BU Incorporador, só deals de pipelines mapeadas para Incorporador são considerados.

### Implementação

**1. `src/hooks/useContactsEnriched.ts`** — Aceitar parâmetro `originIds: string[]` opcional:
- Na query, manter a busca de todos deals do contato (necessário para cross-pipeline)
- Na construção do `latestDeal`, filtrar `deals` por `origin_id in originIds` quando fornecido
- Se nenhum deal pertence à BU, o contato terá `latestDeal: null` e `thermalStatus: 'sem_deal'`

**2. `src/pages/crm/Contatos.tsx`** — Passar os `originIds` da BU ativa:
- Importar `useActiveBU` e `useBUOriginIds` 
- Passar os IDs de origem resolvidos para `useContactsEnriched`
- Contatos sem deals na BU ativa ficam com status "sem_deal" (podem ser filtrados ou exibidos como tal)

### Lógica do filtro no enrichment

```text
// Antes (bug):
latestDeal = deals.sort(by created_at desc)[0]  // qualquer pipeline

// Depois (fix):
buDeals = originIds ? deals.filter(d => originIds.includes(d.origin_id)) : deals
latestDeal = buDeals.sort(by created_at desc)[0]  // só deals da BU
```

### Arquivos afetados
- `src/hooks/useContactsEnriched.ts` — Adicionar filtro por `originIds` no `latestDeal`
- `src/pages/crm/Contatos.tsx` — Passar `originIds` da BU ativa via `useBUOriginIds`

