
# Plano: Adicionar Filtro de Produtos na Página Vendas MCF Incorporador

## Objetivo
Adicionar um botão de filtro de produtos na página `/bu-incorporador/transacoes` que permite selecionar quais produtos devem aparecer na tabela, utilizando o componente `ProductFilterSheet` já existente.

## Arquitetura Atual

A página `TransacoesIncorp.tsx` usa:
- Hook `useAllHublaTransactions` para buscar dados via RPC `get_all_hubla_transactions`
- Filtros existentes: busca por texto, data inicial e data final
- Componente `ProductFilterSheet` já existe mas não está integrado nesta página

## Implementação

### 1. Atualizar a função RPC no banco de dados
Adicionar parâmetro `p_products` à função `get_all_hubla_transactions`:

```sql
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_products TEXT[] DEFAULT NULL,  -- NOVO
  p_limit INT DEFAULT 1000
)
...
WHERE ...
  AND (p_products IS NULL OR ht.product_name = ANY(p_products))
```

### 2. Atualizar o hook `useAllHublaTransactions`
- Adicionar `selectedProducts` ao tipo `TransactionFilters`
- Incluir no queryKey e na chamada RPC

### 3. Atualizar a página `TransacoesIncorp.tsx`
- Adicionar estado `selectedProducts` e `productFilterOpen`
- Importar e renderizar `ProductFilterSheet`
- Adicionar botão "Filtrar Produtos" na área de filtros
- Mostrar badge com quantidade de produtos selecionados

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | Nova migration com RPC atualizada |
| `src/hooks/useAllHublaTransactions.ts` | Adicionar `selectedProducts` aos filtros |
| `src/pages/bu-incorporador/TransacoesIncorp.tsx` | Integrar componente de filtro |

## Interface Final

A área de filtros terá:
```
[Buscar...] [Data Inicial] [Data Final] [Produtos (N)] [X Limpar]
```

O botão "Produtos" abrirá o Sheet lateral com a lista de todos os produtos disponíveis para seleção múltipla.

## Detalhes Técnicos

### Modificação no TransacoesIncorp.tsx
```typescript
// Novos estados
const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
const [productFilterOpen, setProductFilterOpen] = useState(false);

// Filtros atualizados
const filters: TransactionFilters = {
  search: searchTerm || undefined,
  startDate,
  endDate,
  selectedProducts: selectedProducts.length > 0 ? selectedProducts : undefined,
};
```

### Botão de Filtro
Será adicionado na área de filtros com ícone `Filter` e badge mostrando quantidade selecionada.
