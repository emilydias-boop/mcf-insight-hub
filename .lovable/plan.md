
# Correcao do Timeout nas Transacoes - Relatorios Incorporador

## Problema Identificado

A funcao RPC `get_hubla_transactions_by_bu` esta dando **timeout** (erro 57014) porque executa uma subconsulta correlacionada para cada uma das 31.145+ linhas, buscando `deal_tags` do CRM.

### Evidencia do Erro

```json
{
  "code": "57014",
  "message": "canceling statement due to statement timeout"
}
```

### Causa Raiz

Subconsulta correlacionada com `LOWER()` para cada linha:

```sql
COALESCE(
  (SELECT d.tags 
   FROM crm_contacts c
   INNER JOIN crm_deals d ON d.contact_id = c.id
   WHERE LOWER(c.email) = LOWER(ht.customer_email)
   LIMIT 1),
  ARRAY[]::text[]
) as deal_tags
```

Este padrao e conhecido como "N+1 query problem" e causa:
- 31.145 subconsultas executadas sequencialmente
- Uso de `LOWER()` que impede indices
- Joins pesados em tabelas grandes

### Descoberta Importante

Os `deal_tags` **nao sao utilizados** no componente `SalesReportPanel.tsx`:
- Linha 222: `'Tags': ''` (sempre vazio no export)
- Nenhum filtro ou exibicao usa essa coluna

---

## Solucao

### Passo 1: Otimizar Funcao RPC (Remover Subconsulta)

Recriar a funcao `get_hubla_transactions_by_bu` **sem** a subconsulta de `deal_tags`:

```sql
CREATE OR REPLACE FUNCTION public.get_hubla_transactions_by_bu(
  p_bu text,
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(...)
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.hubla_id::text,
    ht.product_name::text,
    ...
    ARRAY[]::text[] as deal_tags  -- Retorna array vazio (sem subconsulta)
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = p_bu
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual')
    AND (filtros...)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;
```

### Impacto Esperado

| Metrica | Antes | Depois |
|---------|-------|--------|
| Tempo de execucao | >30 segundos (timeout) | <1 segundo |
| Subconsultas | 31.145+ por request | 0 |
| Status | Erro 500 | Sucesso 200 |

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| Nova migracao SQL | Recriar funcao sem subconsulta de deal_tags |

---

## Alternativa Futura

Se futuramente os `deal_tags` forem necessarios, a solucao correta seria:

1. Usar LEFT JOIN em vez de subconsulta correlacionada
2. Criar indice em `crm_contacts.email` (case-insensitive)
3. Ou pre-calcular tags em coluna da hubla_transactions

Mas para agora, remover a subconsulta resolve o problema imediatamente.
