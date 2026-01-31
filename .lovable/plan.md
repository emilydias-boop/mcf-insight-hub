
# Implementação: Filtro de Produtos na Página Vendas MCF Incorporador

## Objetivo
Adicionar um botão de filtro de produtos que permite selecionar quais produtos devem aparecer na tabela.

## Mudanças Necessárias

### 1. Migration SQL (Banco de Dados)
Criar arquivo `supabase/migrations/20260131_add_products_filter_to_get_all_hubla_transactions.sql`:
- Adicionar parâmetro `p_products TEXT[] DEFAULT NULL` à função RPC
- Adicionar filtro: `AND (p_products IS NULL OR ht.product_name = ANY(p_products))`

### 2. Hook useAllHublaTransactions.ts
- Adicionar `selectedProducts?: string[]` ao tipo `TransactionFilters`
- Incluir `selectedProducts` no `queryKey`
- Passar `p_products` na chamada RPC

### 3. Página TransacoesIncorp.tsx
- Importar `ProductFilterSheet`, `Badge` e ícone `Filter`
- Adicionar estados: `selectedProducts` e `productFilterOpen`
- Incluir `selectedProducts` no objeto `filters`
- Adicionar botão "Produtos" com badge de contagem
- Renderizar `ProductFilterSheet` component
- Atualizar `handleClearFilters` para limpar produtos selecionados

## Interface Visual

A área de filtros ficará:
```
[Buscar...] [Data Inicial] [Data Final] [Produtos (N)] [X]
```

O botão "Produtos" abrirá o Sheet lateral com lista de todos os produtos disponíveis para seleção múltipla.
