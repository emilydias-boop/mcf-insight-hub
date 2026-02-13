

# Corrigir Timeout no Relatório de Vendas (Meses Anteriores)

## Problema

A RPC `get_all_hubla_transactions` faz timeout (~41s) ao consultar meses anteriores. A causa raiz e a sub-query `EXISTS` de deduplicacao Make/Hubla que executa ~3.000 vezes por consulta, cada uma varrendo a tabela inteira via `idx_hubla_transactions_net_value` (indice irrelevante para esse filtro).

## Causa Tecnica

A subquery filtra por `LOWER(customer_email)`, `sale_date::date` e `source = 'hubla'`, mas nao existe indice composto para essas colunas. O Postgres faz um Index Scan no indice errado e remove ~11.769 linhas por filtro em cada iteracao.

## Solucao

Criar um indice composto que cubra exatamente a subquery de deduplicacao e otimize o JOIN principal.

### Migracao SQL

```text
-- Indice para acelerar a subquery EXISTS de deduplicacao Make/Hubla
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hubla_dedup_email_date 
ON hubla_transactions (source, lower(customer_email), (sale_date::date))
WHERE net_value > 0;

-- Indice para acelerar o JOIN com product_configurations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hubla_product_name_date 
ON hubla_transactions (product_name, sale_date)
WHERE sale_status IN ('completed', 'refunded') 
  AND source IN ('hubla', 'manual', 'make');
```

### Resultado Esperado

- A subquery EXISTS usara o indice `idx_hubla_dedup_email_date` e fara um Index Scan direto em vez de varrer ~12.000 linhas por iteracao
- Tempo de execucao estimado cai de ~41s para menos de 1s
- Nenhuma alteracao de codigo necessaria - apenas indices no banco de dados

