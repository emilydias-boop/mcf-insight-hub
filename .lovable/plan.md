

## Correção: Vendas mcfpay não aparecem no dashboard

### Problema
Duas causas encontradas:

1. **Categoria errada no webhook handler**: A função `getProductCategory()` mapeia A001/A009 como `'parceria'`, mas deveria ser `'incorporador'` (matching `product_configurations`). Isso causa o trigger incorreto da automação `autoMarkSaleComplete` e classifica as vendas na categoria errada.

2. **RPC exclui source 'mcfpay'**: `get_all_hubla_transactions` filtra `source IN ('hubla', 'manual', 'make')`, excluindo completamente as transações do mcfpay.

### Correções

**1. `supabase/functions/asaas-webhook-handler/index.ts`**
- Corrigir `getProductCategory`: A001/A009 devem ser `'incorporador'`, não `'parceria'`
- Idealmente, buscar a categoria da tabela `product_configurations` em vez de hardcodar

**2. Migration SQL: Atualizar RPC**
- Adicionar `'mcfpay'` ao filtro de source: `AND ht.source IN ('hubla', 'manual', 'make', 'mcfpay')`
- Aplicar nas duas RPCs: `get_all_hubla_transactions` e `get_hubla_transactions_by_bu`

**3. Corrigir dados existentes**
- Atualizar `product_category` das transações mcfpay existentes para as categorias corretas (via query de correção usando JOIN com `product_configurations`)

### Dados afetados
- 61 transações mcfpay no banco, maioria com categoria incorreta
- Após correção, aparecerão na página de Vendas MCF Incorporador

