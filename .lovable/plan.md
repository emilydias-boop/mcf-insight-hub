

## Fix: Contagem de Contratos — 98 → 62

### Causa raiz
O relatório de análise de carrinho usa filtros muito amplos comparado à página de Vendas:

| Filtro | Página de Vendas (62) | Relatório Carrinho (98) |
|--------|----------------------|------------------------|
| Produto | Apenas `A000 - Contrato` | Todos (`incorporador` + `contrato`) |
| Join `product_configurations` | Sim (`target_bu = 'incorporador'`) | Não |
| Exclui `newsale-%` | Sim | Não |
| Exclui `make` duplicatas | Sim | Não |
| Filtra por `source` | Sim (hubla, manual, make, mcfpay, kiwify) | Não |

### Correção: `src/hooks/useCarrinhoAnalysisReport.ts`

Alinhar a query de transações com a mesma lógica da RPC `get_all_hubla_transactions`:

1. **Filtrar apenas `product_name = 'A000 - Contrato'`** — é o único produto que representa contrato real no carrinho
2. **Adicionar filtro `hubla_id NOT LIKE 'newsale-%'`** — remove duplicatas de importação
3. **Filtrar por `source IN ('hubla', 'manual', 'make', 'mcfpay', 'kiwify')`** — exclui fontes inválidas
4. **Excluir `make` + `contrato` lowercase** — mesma regra da RPC
5. **Filtrar `sale_status IN ('completed', 'refunded')`** em vez de excluir event_type — alinha com a lógica correta

A query atualizada será client-side pois Supabase JS não suporta `NOT LIKE`, então filtraremos após fetch:

```typescript
const { data: transactions } = await supabase
  .from('hubla_transactions')
  .select('...')
  .eq('product_name', 'A000 - Contrato')
  .in('sale_status', ['completed', 'refunded'])
  .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
  .gte('sale_date', startStr)
  .lte('sale_date', endStr + 'T23:59:59');

// Client-side: remove newsale- and make/contrato duplicates
const validTransactions = transactions.filter(t => {
  if (t.hubla_id?.startsWith('newsale-')) return false;
  if (t.source === 'make' && t.product_name?.toLowerCase() === 'contrato') return false;
  if (t.installment_number > 1) return false;
  return true;
});
```

### Resultado esperado
- Contratos: **62** (alinhado com página de Vendas)
- Refunds identificados corretamente via `sale_status = 'refunded'`

