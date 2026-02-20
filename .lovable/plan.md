
# Visibilidade de Leads Outside no Kanban

## Objetivo

Permitir que a gestora (Jessica Bellini) identifique visualmente e filtre leads "Outside" no Kanban para distribui-los manualmente aos SDRs via transferencia em massa.

## Alteracoes

### 1. Novo hook: `src/hooks/useOutsideDetectionForDeals.ts`

Hook dedicado para detectar Outside em deals do Kanban. Recebe um array de deals, extrai emails dos contatos, busca `hubla_transactions` com `product_name ILIKE '%Contrato%'` e `sale_status = 'completed'`, e retorna um `Map<dealId, boolean>`.

A logica: se o contato tem uma transacao de contrato com `sale_date` anterior ao `created_at` do deal, e Outside. Reutiliza a funcao `batchedInOutside` do hook existente.

### 2. Badge "Outside" no card: `src/components/crm/DealKanbanCard.tsx`

- Adicionar prop opcional `isOutside?: boolean`
- Quando `true`, renderizar badge amarelo com "$" e texto "Outside" na linha de badges (junto com A010, BIO, etc.)
- Visual: `bg-yellow-100 text-yellow-700 border-yellow-300`

### 3. Passar dados ao board: `src/components/crm/DealKanbanBoard.tsx`

- Adicionar prop `outsideMap?: Map<string, boolean>` na interface
- Passar `isOutside={outsideMap?.get(deal.id) || false}` para cada `DealKanbanCard`

### 4. Filtro Outside nos filtros: `src/components/crm/DealFilters.tsx`

- Adicionar campo `outsideFilter: 'all' | 'outside_only' | 'not_outside'` ao `DealFiltersState`
- Adicionar um Select com icone `$` na barra de filtros com opcoes: "Todos", "Apenas Outside", "Sem Outside"

### 5. Integrar tudo no Negocios: `src/pages/crm/Negocios.tsx`

- Importar e usar `useOutsideDetectionForDeals` com os deals carregados
- Adicionar `outsideFilter: 'all'` ao estado inicial de filtros
- Aplicar filtro de Outside no `filteredDeals` (comparar com o mapa retornado pelo hook)
- Passar `outsideMap` para o `DealKanbanBoard`
- Adicionar `outsideFilter` ao `clearFilters`

## Fluxo da gestora

1. Abrir Negocios na pipeline da BU Incorporador
2. No filtro "Outside", selecionar "Apenas Outside"
3. Ver apenas os leads Outside (com badge amarelo "$")
4. Selecionar os leads desejados (checkboxes)
5. Clicar "Transferir" na barra de acoes em massa
6. Escolher o SDR destino
7. Apos transferencia, o SDR vera esses leads no proprio Kanban

## Arquivos modificados

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `src/hooks/useOutsideDetectionForDeals.ts` | Novo | Hook para detectar Outside em deals |
| `src/components/crm/DealKanbanCard.tsx` | Editar | Badge amarelo "Outside" |
| `src/components/crm/DealKanbanBoard.tsx` | Editar | Prop `outsideMap` e repasse ao card |
| `src/components/crm/DealFilters.tsx` | Editar | Novo filtro `outsideFilter` no state e UI |
| `src/pages/crm/Negocios.tsx` | Editar | Integrar hook, filtro e mapa |
