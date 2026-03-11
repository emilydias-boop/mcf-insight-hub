

## Filtros duplicados na página de detalhe do Closer

### Problema

A página usa dois componentes de filtro empilhados:
1. **`CloserLeadsFilters`** — busca por texto, status, SDR, e presets de data (Todos/Hoje/Semana/Mês/Custom)
2. **`CloserLeadsTable`** — tem seus próprios filtros internos: busca por texto, status select, e badges de status com contagem

Ambos fazem a mesma coisa (filtrar por nome/email/telefone e por status), resultando em redundância visual e funcional.

### Correção

**Remover `CloserLeadsFilters`** das tabs de leads/noshows/r2 em `CloserMeetingsDetailPage.tsx`, pois o `CloserLeadsTable` já possui filtros completos (busca, status com contagem, exportação Excel).

O único recurso extra do `CloserLeadsFilters` é o filtro por SDR e os presets de data — mas o período já é controlado globalmente no header da página. O filtro de SDR pode ser adicionado ao `CloserLeadsTable` se necessário.

### Alterações

1. **`src/pages/crm/CloserMeetingsDetailPage.tsx`**: Remover os 3 `<CloserLeadsFilters>` das tabs leads, noshows e r2. Passar `leads`/`noShowLeads`/`r2Leads` diretamente para `CloserLeadsTable` (sem o intermediário de `filteredLeads` state). Remover os states e callbacks de `onFilterLeads`, `onFilterNoShows`, `onFilterR2`.

2. **`src/components/closer/CloserLeadsTable.tsx`**: Adicionar um filtro opcional de SDR (select dropdown) para manter essa funcionalidade que existia no `CloserLeadsFilters`.

