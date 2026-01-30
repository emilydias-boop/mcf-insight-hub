

# Correção: Transações ASAAS/Make não aparecem na página de Vendas MCF Incorporador

## Diagnóstico

Ao analisar o problema, identifiquei que as transações do **William Santos Gondim**, **Joabe Castelo Araujo** e outros leads com pagamentos via ASAAS aparecem na aba "Vendas" do Carrinho R2, mas **não aparecem** na página principal de "Vendas MCF Incorporador".

### Causa Raiz

A função RPC `get_all_hubla_transactions` filtra transações por `source`:

```sql
AND ht.source IN ('hubla', 'manual', 'asaas', 'kiwify')
```

**Problema**: As transações que você editou (William, Joabe, etc.) têm `source = 'make'`, que está **excluído** do filtro.

### Dados Afetados

| Cliente | Produto Atualizado | Source | Status |
|---------|-------------------|--------|--------|
| WILLIAM SANTOS GONDIM | A001 - MCF INCORPORADOR COMPLETO | make | ❌ Excluído |
| Joabe Castelo Araujo | A001 - MCF INCORPORADOR COMPLETO | make | ❌ Excluído |
| NELSON EBERSOL BRUM | A009 - MCF INCORPORADOR COMPLET... | make | ❌ Excluído |

Total: **13 transações** da semana de 24/01 - 30/01 que deveriam aparecer mas não aparecem.

## Solução

Atualizar a função RPC `get_all_hubla_transactions` para incluir `'make'` no filtro de sources:

```sql
AND ht.source IN ('hubla', 'manual', 'asaas', 'kiwify', 'make')
```

## Implementação

### Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migration SQL | Atualizar a função RPC para incluir 'make' nos sources permitidos |

### SQL da Migration

```sql
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 1000
)
RETURNS TABLE (
  id UUID,
  hubla_id TEXT,
  product_name TEXT,
  product_category TEXT,
  product_price NUMERIC,
  net_value NUMERIC,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  sale_date TIMESTAMPTZ,
  sale_status TEXT,
  installment_number INT,
  total_installments INT,
  source TEXT,
  gross_override NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.hubla_id,
    ht.product_name,
    ht.product_category,
    ht.product_price,
    ht.net_value,
    ht.customer_name,
    ht.customer_email,
    ht.customer_phone,
    ht.sale_date,
    ht.sale_status,
    ht.installment_number,
    ht.total_installments,
    ht.source,
    ht.gross_override
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc 
    ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND pc.is_active = true
    AND pc.count_in_dashboard = true
    AND ht.source IN ('hubla', 'manual', 'asaas', 'kiwify', 'make')  -- ADICIONADO 'make'
    AND (ht.hubla_id IS NULL OR ht.hubla_id NOT LIKE 'newsale-%')
    AND (p_search IS NULL OR (
      ht.customer_name ILIKE '%' || p_search || '%' OR
      ht.customer_email ILIKE '%' || p_search || '%' OR
      ht.product_name ILIKE '%' || p_search || '%'
    ))
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;
```

## Resultado Esperado

Após a migration:

- **13 transações adicionais** da semana aparecerão na página de Vendas MCF Incorporador
- Os totais de Bruto e Líquido serão atualizados automaticamente
- As transações do William, Joabe, Nelson e outros serão corretamente contabilizadas
- A consistência entre a aba "Vendas" do Carrinho R2 e a página principal de Vendas será restaurada

## Notas Técnicas

A fonte `make` corresponde a transações consolidadas via Make/Integromat, que inclui pagamentos de diversos gateways (incluindo ASAAS). Ao incluir esta fonte, capturamos todas as vendas que foram manualmente corrigidas na aba do Carrinho R2.

