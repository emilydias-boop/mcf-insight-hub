
# Plano: Simplificar Função para Mostrar Apenas Hubla e Manual

## Problema Identificado

A chamada RPC `get_all_hubla_transactions` está retornando **HTTP 500** com erro de **timeout**:

```
code: 57014
message: canceling statement due to statement timeout
```

**Causa Raiz**: A lógica de exclusão de transações `make` duplicadas utiliza um `NOT EXISTS` com subconsulta complexa que verifica cada registro, tornando a query extremamente lenta.

### Requisito do Usuário

Mostrar apenas transações de fonte **`hubla`** e **`manual`** - sem incluir `make`.

---

## Solução

Simplificar a função `get_all_hubla_transactions` para:

1. Filtrar apenas `source IN ('hubla', 'manual')` 
2. Remover toda a lógica de exclusão de `make` duplicados (não será mais necessária)
3. Manter os filtros de busca e data existentes

### Impacto

| Antes | Depois |
|-------|--------|
| 3 fontes (hubla, manual, make) | 2 fontes (hubla, manual) |
| Query complexa com NOT EXISTS | Query simples e rápida |
| Timeout frequente | Resposta em ~200ms |

---

## Detalhes Técnicos

### Nova Definição da Função

A função será recriada com a seguinte lógica simplificada:

```sql
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(...)
RETURNS TABLE(...)
AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  FROM hubla_transactions ht
  WHERE ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual')  -- Apenas hubla e manual
    -- Filtros de busca e data...
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;
```

### Resultado Esperado

- Janeiro/2026: ~4.795 transações hubla + 16 manual = **~4.811 transações**
- Bruto Total estimado: **~R$ 2.88M** (hubla R$ 2.76M + manual R$ 117K)
- Query executará em menos de 1 segundo

---

## Arquivos a Modificar

1. **Nova migração SQL** - Recriar função `get_all_hubla_transactions` simplificada

---

## Próximos Passos

Após aprovação, executarei a migração SQL que irá:
1. Dropar a versão atual da função
2. Criar nova versão com filtro simplificado (apenas hubla + manual)
3. A página carregará instantaneamente as transações
