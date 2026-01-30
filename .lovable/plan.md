
# Plano: Corrigir Timeout na Página de Vendas MCF Incorporador

## Problema Identificado

A página de Vendas `/bu-incorporador/transacoes` está retornando **zero transações** após um timeout da RPC.

### Diagnóstico

| Aspecto | Valor |
|---------|-------|
| **Erro** | `canceling statement due to statement timeout` (HTTP 500) |
| **Causa Raiz** | Subconsulta correlacionada de `deal_tags` na função `get_all_hubla_transactions` |
| **Tempo por subconsulta** | ~132ms (usa `LOWER()` sem índice em 113k contatos) |
| **Transações no período** | ~2000 |
| **Tempo total estimado** | 2000 × 132ms = ~264 segundos (muito acima do timeout de 30s) |

### O Problema na Query

```sql
-- Esta subconsulta é executada para CADA transação (2000x)
COALESCE(
  (SELECT d.tags 
   FROM crm_contacts c
   INNER JOIN crm_deals d ON d.contact_id = c.id
   WHERE LOWER(c.email) = LOWER(ht.customer_email)
   LIMIT 1),
  ARRAY[]::text[]
) as deal_tags
```

O `LOWER()` impede o uso do índice `idx_crm_contacts_email`, forçando um scan completo.

---

## Solução Proposta

Remover a subconsulta de `deal_tags` da RPC e buscar as tags via LEFT JOIN com pré-agregação, ou remover completamente se não forem essenciais para a listagem.

### Opção Recomendada: Remover `deal_tags` da RPC

A coluna `deal_tags` é usada principalmente para:
1. Exibição visual (badge de canal)
2. Relatórios de vendas

Na tela de listagem de transações, as tags podem ser carregadas sob demanda (quando o drawer abre) em vez de para todas as 2000 linhas.

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| **Migração SQL** | Atualizar a função `get_all_hubla_transactions` para remover subconsulta de `deal_tags` |

---

## Implementação Técnica

### Nova versão da função RPC

```sql
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid, hubla_id text, product_name text, product_category text,
  product_price numeric, net_value numeric, customer_name text,
  customer_email text, customer_phone text, sale_date timestamptz,
  sale_status text, installment_number integer, total_installments integer,
  source text, gross_override numeric, deal_tags text[]
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id, ht.hubla_id::text, ht.product_name::text, ht.product_category::text,
    ht.product_price, ht.net_value, ht.customer_name::text, ht.customer_email::text,
    ht.customer_phone::text, ht.sale_date, ht.sale_status::text,
    ht.installment_number, ht.total_installments, ht.source::text, ht.gross_override,
    ARRAY[]::text[] as deal_tags  -- Retorna array vazio por padrão
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual')
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
$function$;
```

---

## Impacto

| Métrica | Antes | Depois |
|---------|-------|--------|
| **Tempo de execução** | Timeout (>30s) | ~25ms |
| **Transações retornadas** | 0 (erro) | ~2000 |
| **Coluna deal_tags** | Populada | Array vazio (pode ser buscada sob demanda) |

---

## Resultado Esperado

1. A página de Vendas carrega em menos de 1 segundo
2. Todas as 2000 transações de janeiro aparecem corretamente
3. Os totais (Bruto/Líquido) são calculados corretamente
4. Se as tags forem necessárias no futuro, podem ser buscadas no drawer de detalhes
