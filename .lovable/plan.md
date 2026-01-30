
# Plano de Correção - Transações "Parceria" e "Contrato" Duplicadas

## Diagnóstico

As transações com `product_name = 'Parceria'` e `product_name = 'Contrato'` (source: `make`) são **registros auxiliares** criados pela automação Make/Integromat para rastreamento interno. Elas **duplicam** as vendas reais que já existem no Hubla.

### Dados do Problema
| Produto | Source | Total | Comportamento |
|---------|--------|-------|---------------|
| Parceria | make | 186 | Duplica venda Hubla A009/A001/etc |
| Contrato | make | 349 | Duplica venda Hubla A000 |

### Exemplo de Duplicação (Anderson Dhonik)
```
1. Hubla: A009 - MCF INCORPORADOR COMPLETO + THE CLUB → R$ 19.500 (Novo)
2. Make:  Parceria                                    → R$ 0,00 (Recorrente) ❌ DUPLICATA
```

---

## Solução

Atualizar a função `get_all_hubla_transactions` para **excluir** transações Make com nomes genéricos que são apenas registros de rastreamento:

### Cláusula WHERE adicional:
```sql
-- Excluir transações Make auxiliares que duplicam vendas Hubla
AND NOT (
  ht.source = 'make' 
  AND LOWER(ht.product_name) IN ('parceria', 'contrato', 'ob construir para alugar')
)
```

---

## SQL da Correção

```sql
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, text, text, integer);

CREATE FUNCTION public.get_all_hubla_transactions(...)
RETURNS TABLE(...)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc 
    ON LOWER(ht.product_name) = LOWER(pc.product_name)
  WHERE 
    ht.sale_status IN ('completed', 'refunded')
    AND ht.hubla_id NOT LIKE 'newsale-%'
    AND ht.source IN ('hubla', 'manual', 'make')
    
    -- NOVA REGRA: Excluir transações Make auxiliares
    AND NOT (
      ht.source = 'make' 
      AND LOWER(ht.product_name) IN ('parceria', 'contrato', 'ob construir para alugar')
    )
    
    AND (filtros de busca...)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;
```

---

## Impacto Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Transações exibidas | ~4.203 | ~3.668 (menos duplicatas) |
| "Recorrente" incorretos | 535+ | 0 |
| Duplicatas visíveis | Sim | Não |

---

## Detalhes Técnicos

### Por que essas transações existem?
As transações `make_parceria_*` e `make_contrato_*` são criadas automaticamente pelo sistema de automação Make para:
1. Registrar o momento exato de uma venda via webhook
2. Permitir rastreamento de parcerias
3. Servir como fallback caso o webhook Hubla falhe

Elas **não são vendas adicionais** - são registros de controle que espelham vendas já existentes no Hubla.

### Produtos a excluir do source 'make':
- `parceria` (registro auxiliar de venda)
- `contrato` (registro auxiliar de A000)
- `ob construir para alugar` (order bump auxiliar)

### Produtos Make que devem CONTINUAR aparecendo:
- Transações manuais específicas com nomes de produtos reais (ex: A009, A001)
- Produtos que não têm equivalente automático no Hubla
