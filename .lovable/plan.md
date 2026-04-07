

# Filtro de Produtos Adquiridos na Pipeline de Negocios

## Problema
Nao existe forma de filtrar leads por produto adquirido (ex: EFEITO ALAVANCA 2026). Isso impede ações operacionais como identificar e remover leads que pertencem a outra BU.

## Solucao

### Arquitetura
Reutilizar o mesmo padrão do filtro de Tags (AND/OR + has/not_has), mas cruzando o email do deal com a tabela `hubla_transactions` para detectar produtos comprados.

```text
Fluxo:
1. Negocios.tsx extrai emails dos deals carregados
2. Novo hook busca em batch: email → lista de produtos comprados (hubla_transactions)
3. ProductFilterPopover permite selecionar regras (Possui / Nao possui produto X)
4. Filtro client-side aplica as regras no useMemo de filteredDeals
```

### Componentes e arquivos

| Arquivo | Acao |
|---|---|
| `src/hooks/useProductFilterData.ts` | **Novo** — hook que recebe array de emails, busca `hubla_transactions` (completed/paid), retorna `Map<email, Set<productLabel>>` com produtos classificados |
| `src/components/crm/ProductFilterPopover.tsx` | **Novo** — UI identica ao TagFilterPopover mas com icone de Package e lista de produtos disponiveis |
| `src/components/crm/DealFilters.tsx` | Adicionar `productFilters` e `productOperator` ao state + renderizar o ProductFilterPopover |
| `src/pages/crm/Negocios.tsx` | Chamar o hook com emails dos deals, aplicar filtro de produtos no `filteredDeals` |

### Hook `useProductFilterData`
- Recebe `emails: string[]`
- Query unica: `SELECT customer_email, product_name FROM hubla_transactions WHERE customer_email IN (...) AND sale_status IN ('completed','paid')`
- Classifica cada product_name em um label amigavel (ex: "EFEITO ALAVANCA 2026", "A001", "A010", etc.)
- Retorna `{ productMap: Map<string, Set<string>>, availableProducts: string[] }`
- staleTime 5min

### ProductFilterPopover
- Mesma estrutura do TagFilterPopover (operador E/OU, modo Possui/Nao possui, busca, scroll)
- Icone: `Package` do Lucide
- Lista de produtos vem do hook (produtos reais encontrados nos deals carregados)

### Filtro no Negocios
No bloco `filteredDeals`, apos o filtro de tags:
```
if (productFilters.length > 0) {
  const email = deal.crm_contacts?.email?.toLowerCase();
  const dealProducts = email ? productMap.get(email) : new Set();
  // Avaliar cada regra has/not_has com operador AND/OR
}
```

### Classificacao de produtos
Em vez de classificar em labels curtos (como o partner detection faz), manter o `product_name` original limpo (sem prefixo "A0XX - ") para facilitar a busca textual. Agrupar variantes obvias (ex: todas as variantes de "Efeito Alavanca" viram "Efeito Alavanca").

### DealFiltersState atualizado
```typescript
productFilters: ProductFilterRule[];  // { product: string; mode: 'has' | 'not_has' }
productOperator: 'and' | 'or';
```

