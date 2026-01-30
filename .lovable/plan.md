
# Plano de Correção - Filtrar Transações por BU Incorporador

## Diagnóstico

A função `get_all_hubla_transactions` não está filtrando por `target_bu`, trazendo transações de **todas as BUs**:

| BU | Transações | Líquido |
|----|------------|---------|
| incorporador | 2.080 | R$ 1.413.357 |
| SEM_BU (NULL) | 987 | R$ 874.990 ❌ |
| projetos | 586 | R$ 22.802 ❌ |
| consorcio | 530 | R$ 125.184 ❌ |
| outros | 41 | R$ 5.352 ❌ |

O produto "Imersão Presencial Alphaville-SP - Efeito Alavanca 02/02" tem `target_bu = NULL` e está entrando na listagem do Incorporador incorretamente.

---

## Solução

Adicionar filtro `pc.target_bu = 'incorporador'` na função SQL:

```sql
FROM hubla_transactions ht
INNER JOIN product_configurations pc 
  ON LOWER(ht.product_name) = LOWER(pc.product_name)
WHERE 
  pc.target_bu = 'incorporador'  -- ✅ NOVO FILTRO
  AND ht.sale_status IN ('completed', 'refunded')
  AND ht.hubla_id NOT LIKE 'newsale-%'
  -- ... resto das condições
```

---

## Impacto Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Total de Transações | ~4.200 | ~2.080 |
| Líquido Total | ~R$ 2.4M | ~R$ 1.4M |
| Produtos exibidos | 91 (todas BUs) | 21 (incorporador) |

---

## Produtos do Incorporador (21 produtos)

Os seguintes produtos continuarão aparecendo:

- A000 - Contrato (R$ 497)
- A001 - MCF INCORPORADOR COMPLETO (R$ 14.500)
- A001 - MCF INCORPORADOR COMPLETO + THE CLUB (R$ 14.500)
- A002 - MCF INCORPORADOR BÁSICO (R$ 14.500)
- A003 - MCF Plano Anticrise Completo (R$ 7.500)
- A004 - MCF Plano Anticrise Básico (R$ 5.500)
- A005 - MCF P2 (R$ 0)
- A006 - Renovação Parceiro MCF (R$ 1.000)
- A007 - Imersão SÓCIOS MCF (R$ 1.500)
- A008 - The CLUB (R$ 1.500)
- A009 - MCF INCORPORADOR + THE CLUB (R$ 19.500)
- A009 - MCF INCORPORADOR COMPLETO + THE CLUB (R$ 19.500)
- A010 - Construa para Vender sem Dinheiro (R$ 47)
- A010 - Consultoria Construa para Vender (R$ 47)
- A010 - MCF Fundamentos (R$ 47)
- ACESSO VITALÍCIO (R$ 57)
- Imersão Sócios MCF (R$ 2.500)
- 000 - Contrato (R$ 497)
- A000 - Pré-Reserva Plano Anticrise (R$ 997)

---

## Seção Técnica

### SQL da Correção

```sql
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, text, text, integer);

CREATE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id text,
  hubla_id text,
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id::text,
    ht.hubla_id::text,
    COALESCE(pc.display_name, ht.product_name)::text as product_name,
    pc.product_code::text as product_category,
    COALESCE(ht.gross_override, pc.reference_price, ht.product_price)::numeric as product_price,
    ht.net_value::numeric,
    ht.customer_name::text,
    ht.customer_email::text,
    ht.customer_phone::text,
    ht.sale_date,
    ht.sale_status::text,
    ht.installment_number::integer,
    ht.total_installments::integer,
    ht.source::text,
    ht.gross_override::numeric
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc 
    ON LOWER(ht.product_name) = LOWER(pc.product_name)
  WHERE 
    pc.target_bu = 'incorporador'  -- NOVO: Filtrar apenas produtos do Incorporador
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.hubla_id NOT LIKE 'newsale-%'
    AND ht.source IN ('hubla', 'manual', 'make')
    AND NOT (
      ht.source = 'make' 
      AND LOWER(ht.product_name) IN ('parceria', 'contrato', 'ob construir para alugar')
    )
    AND (p_search IS NULL OR 
         ht.customer_name ILIKE '%' || p_search || '%' OR 
         ht.customer_email ILIKE '%' || p_search || '%' OR
         ht.product_name ILIKE '%' || p_search || '%')
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date::timestamptz)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_hubla_transactions(...) TO anon, authenticated;
```

### Arquivos Modificados

1. Nova migration SQL para atualizar a função RPC

### Migração de Dados Necessária

Nenhuma. O filtro utiliza a coluna `target_bu` já existente na tabela `product_configurations`.
