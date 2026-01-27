
# Plano: Corrigir Duplicacao de Transacoes na Listagem

## Problema Identificado

A funcao RPC `get_all_hubla_transactions` esta retornando registros de notificacao (`newsale-*`) que sao duplicatas das transacoes reais.

### Causa Raiz

A migracao `20260127151638_b338b00b-7355-4356-8f31-91040b14a6b2.sql` removeu o filtro:
```sql
AND ht.hubla_id NOT LIKE 'newsale-%'
```

### Impacto

- 637 registros duplicados exibidos no periodo de janeiro/2026
- Cada venda aparece duas vezes: uma com valores reais e outra com Bruto/Liquido zerados marcada como "Recorrente"

## Solucao

Adicionar o filtro de exclusao dos registros `newsale-*` de volta na funcao RPC.

### Arquivo a Criar: Nova Migracao SQL

```sql
-- Corrigir get_all_hubla_transactions para excluir registros newsale duplicados
-- Esses registros sao notificacoes de "nova venda" com net_value=0, nao vendas reais

CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
  product_name text,
  product_category text,
  product_price numeric,
  net_value numeric,
  customer_name text,
  customer_email text,
  customer_phone text,
  sale_date timestamp with time zone,
  sale_status text,
  installment_number integer,
  total_installments integer,
  source text,
  gross_override numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
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
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual')
    -- FILTRO ADICIONADO: Excluir registros de notificacao newsale
    AND ht.hubla_id NOT LIKE 'newsale-%'
    AND (p_search IS NULL OR (
      ht.customer_name ILIKE '%' || p_search || '%' OR
      ht.customer_email ILIKE '%' || p_search || '%' OR
      ht.product_name ILIKE '%' || p_search || '%'
    ))
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date::timestamptz)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 2.407 transacoes | ~1.770 transacoes |
| Linhas duplicadas com Bruto/Liquido zerados | Apenas transacoes reais |
| Badge "Recorrente" incorreto em duplicatas | Badges corretos |

## Observacao Tecnica

Os registros `newsale-*` sao criados pelo webhook Hubla como notificacao previa antes da transacao ser confirmada. Eles nao devem ser exibidos na listagem porque:

1. Possuem `net_value = 0` (nao representam receita real)
2. Sao duplicatas dos registros finais com UUID real
3. Confundem a contagem de transacoes e metricas
