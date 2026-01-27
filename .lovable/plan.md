
# Plano: Corrigir Funções RPC Duplicadas para Incluir Reembolsos

## Problema Identificado

Existem **duas versões (overloads)** das funções `get_all_hubla_transactions` e `get_hubla_transactions_by_bu`:

| Versão | Parâmetros de Data | Tabela de Join | Status Atualizado? |
|--------|-------------------|----------------|-------------------|
| 1 | `text` | `hubla_products` | Sim |
| 2 | `timestamp with time zone` | `product_configurations` | **NAO** |

A migration anterior atualizou apenas a Versão 1. A Versão 2 (que usa `product_configurations`) ainda tem:

```sql
WHERE ht.sale_status = 'completed'  -- ERRO: falta 'refunded'
```

Como o frontend passa as datas como `timestamp`, ele usa a Versão 2, que retorna 0 resultados por causa dos filtros extras:
- `hubla_id NOT LIKE 'newsale-%'`
- `source IN ('hubla', 'manual')`
- `NOT EXISTS (...)` para ofertas filhas

## Solucao

Criar uma nova migration que atualiza a **Versao 2** (a que usa `product_configurations`) de ambas as funcoes para incluir `sale_status IN ('completed', 'refunded')`.

## Arquivo a Criar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `supabase/migrations/XXXXXXXX_fix_rpc_refunded_filter.sql` | Criar | Atualizar as overloads com `timestamp with time zone` |

## Conteudo da Migration

```sql
-- Atualizar get_all_hubla_transactions (versao com timestamp)
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(...) AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ...
  WHERE 
    ht.sale_status IN ('completed', 'refunded')  -- CORRECAO
    AND ...
END;
$$ LANGUAGE plpgsql;

-- Atualizar get_hubla_transactions_by_bu (versao com timestamp)
CREATE OR REPLACE FUNCTION public.get_hubla_transactions_by_bu(
  p_target_bu text,
  p_search text DEFAULT NULL,
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(...) AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  WHERE 
    ht.sale_status IN ('completed', 'refunded')  -- CORRECAO
    AND ...
END;
$$ LANGUAGE plpgsql;
```

## Resultado Esperado

1. Transacoes aparecerao na lista (tanto `completed` quanto `refunded`)
2. Transacoes reembolsadas mostrarao o badge vermelho "Reembolso"
3. Linhas reembolsadas terao fundo avermelhado
4. Todas as BUs (Incorporador, Consorcio, Credito, Outros) funcionarao corretamente
