
# Plano de Correção - Transações "Recorrente" Incorretas na Listagem de Vendas

## Diagnóstico Confirmado

Há dois problemas distintos na página "Vendas MCF INCORPORADOR" (`/bu-incorporador/transacoes`):

### Problema 1: Transações "newsale-" aparecem como duplicatas "Recorrente"

O Hubla cria múltiplas transações para cada venda:
- Uma transação "parent" com `hubla_id` começando com `newsale-` e valor inflado (ex: R$ 23.298)
- Uma ou mais transações "offer" com o valor real do produto (ex: R$ 19.500)

A função `get_first_transaction_ids` corretamente **exclui** `newsale-%` da deduplicação. Porém, a função `get_all_hubla_transactions` **não exclui** essas transações da listagem.

**Resultado**: Clientes como Livie, Raissa, Lucas aparecem com 2 linhas cada:
- Linha 1: `newsale-...` com Bruto R$ 0,00 (dup) → "Recorrente" 
- Linha 2: transação real com Bruto correto → "Novo"

### Problema 2: Transações do source "make" não aparecem

A função RPC filtra apenas `source IN ('hubla', 'manual')`, excluindo transações vindas do Make.

Isso faz com que vendas registradas via Make (como a do Lucas com `source: 'make'`) não apareçam na listagem, mesmo sendo parcerias válidas.

---

## Solução Proposta

### Parte A: Excluir transações "newsale-" da listagem

Atualizar a função `get_all_hubla_transactions` para excluir transações parent:

```sql
-- Adicionar filtro:
AND (ht.hubla_id IS NULL OR ht.hubla_id NOT LIKE 'newsale-%')
```

### Parte B: Incluir transações do source "make" na listagem

Atualizar o filtro de source para incluir 'make':

```sql
-- Antes:
AND ht.source IN ('hubla', 'manual')

-- Depois:
AND ht.source IN ('hubla', 'manual', 'make')
```

### Parte C: Sincronizar get_first_transaction_ids

Atualizar a função de deduplicação para também considerar transações 'make':

```sql
-- Antes:
AND ht.source IN ('hubla', 'manual')

-- Depois:
AND ht.source IN ('hubla', 'manual', 'make')
```

### Parte D: Registrar produtos "make" na tabela product_configurations (se necessário)

Verificar se os nomes de produto usados pelo Make estão mapeados:
- `A009 - MCF INCORPORADOR + THE CLUB` ✅ já existe
- `Parceria` ❌ pode não estar mapeado

Se necessário, adicionar configuração para produtos genéricos do Make.

---

## Arquivos a Modificar

### 1. Nova Migration SQL

Criar migration para atualizar ambas as funções RPC:

```sql
-- get_all_hubla_transactions: 
-- 1. Excluir newsale-% (transações parent)
-- 2. Incluir source 'make'

-- get_first_transaction_ids:
-- 1. Incluir source 'make'
```

### 2. (Opcional) Frontend - TransactionGroupRow.tsx

O agrupamento por `hubla_id` pode ser melhorado para consolidar transações Make/Manual com transações Hubla do mesmo cliente, mas isso é secundário. O problema principal está no SQL.

---

## Resultado Esperado

| Cliente | Antes | Depois |
|---------|-------|--------|
| Livie Magalhães | 2 linhas (1 Novo + 1 Recorrente) | 1 linha (Novo, Bruto R$ 19.500) |
| Raissa Farah | 2 linhas (1 Novo + 1 Recorrente) | 1 linha (Novo, Bruto R$ 19.500) |
| Lucas Falvela | 1 linha (Manual) | 2 linhas (Manual + Make, consolidáveis) |

---

## Detalhes Técnicos da Migration

```sql
-- Atualiza get_all_hubla_transactions para:
-- 1. Excluir transações parent (hubla_id LIKE 'newsale-%')
-- 2. Incluir source 'make'

DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, text, text, integer);

CREATE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
  hubla_id text,
  sale_date timestamptz,
  customer_name text,
  customer_email text,
  product_name text,
  gross_value numeric,
  net_value numeric,
  fee_value numeric,
  sale_status text,
  payment_method text,
  installment_number integer,
  total_installments integer,
  source text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.hubla_id::text,
    ht.sale_date,
    ht.customer_name::text,
    ht.customer_email::text,
    ht.product_name::text,
    ht.gross_value,
    ht.net_value,
    ht.fee_value,
    ht.sale_status::text,
    ht.payment_method::text,
    ht.installment_number,
    ht.total_installments,
    ht.source::text,
    ht.created_at
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual', 'make')  -- NOVO: incluir make
    AND (ht.hubla_id IS NULL OR ht.hubla_id NOT LIKE 'newsale-%')  -- NOVO: excluir parents
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

-- Atualiza get_first_transaction_ids para incluir source 'make'
CREATE OR REPLACE FUNCTION public.get_first_transaction_ids()
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH parent_ids AS (
    SELECT DISTINCT SPLIT_PART(hubla_id, '-offer-', 1) as parent_id
    FROM hubla_transactions 
    WHERE hubla_id LIKE '%-offer-%'
  ),
  ranked_transactions AS (
    SELECT 
      ht.id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          LOWER(COALESCE(NULLIF(TRIM(ht.customer_email), ''), 'unknown')),
          CASE 
            WHEN UPPER(ht.product_name) LIKE '%A009%' THEN 'A009'
            WHEN UPPER(ht.product_name) LIKE '%A005%' THEN 'A005'
            WHEN UPPER(ht.product_name) LIKE '%A004%' THEN 'A004'
            WHEN UPPER(ht.product_name) LIKE '%A003%' THEN 'A003'
            WHEN UPPER(ht.product_name) LIKE '%A001%' THEN 'A001'
            WHEN UPPER(ht.product_name) LIKE '%A010%' THEN 'A010'
            WHEN UPPER(ht.product_name) LIKE '%A000%' OR UPPER(ht.product_name) LIKE '%CONTRATO%' THEN 'A000'
            WHEN UPPER(ht.product_name) LIKE '%PLANO CONSTRUTOR%' THEN 'PLANO_CONSTRUTOR'
            ELSE LEFT(UPPER(TRIM(ht.product_name)), 40)
          END
        ORDER BY ht.sale_date ASC
      ) AS rn
    FROM hubla_transactions ht
    INNER JOIN product_configurations pc 
      ON ht.product_name = pc.product_name 
      AND pc.target_bu = 'incorporador'
      AND pc.is_active = true
    WHERE 
      ht.sale_status IN ('completed', 'refunded')
      AND ht.hubla_id NOT LIKE 'newsale-%'
      AND ht.source IN ('hubla', 'manual', 'make')  -- NOVO: incluir make
      AND ht.hubla_id NOT IN (SELECT parent_id FROM parent_ids)
  )
  SELECT ranked_transactions.id
  FROM ranked_transactions
  WHERE rn = 1;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_all_hubla_transactions(text, text, text, integer) TO anon, authenticated;
```

---

## Critérios de Aceite

1. ✅ Transações `newsale-%` não aparecem mais na listagem
2. ✅ Transações do source `make` aparecem na listagem
3. ✅ Apenas 1 linha por venda real (não duplicatas)
4. ✅ Badge "Novo" para primeira compra do cliente+produto
5. ✅ Badge "Recorrente" apenas para clientes que já compraram antes
6. ✅ Bruto Total correto (sem inflação por parents ou duplicatas)
