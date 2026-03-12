

## Adicionar filtro por Produto ao SalesReportPanel

### Mudanças em `src/components/relatorios/SalesReportPanel.tsx`

**1. Novo state**
- `const [selectedProduct, setSelectedProduct] = useState<string>('all')`

**2. Derivar lista de produtos únicos**
- `useMemo` sobre `transactions` para extrair `product_name` distintos, ordenados alfabeticamente

**3. Filtro no `filteredTransactions`**
- Se `selectedProduct !== 'all'`, filtrar `t.product_name === selectedProduct`
- Adicionar ao array de dependências do `useMemo`

**4. UI — Select na Row 2 dos filtros**
- Adicionar `<Select>` de Produto entre Closer R2 e Canal (ou posição similar), com `SelectItem` para cada produto único
- Largura `w-[200px]` (nomes de produto são mais longos)

**5. Integrar no `hasActiveFilters`, `clearAllFilters`, e reset de `currentPage`**

