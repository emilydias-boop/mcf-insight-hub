
# Plano: Corrigir Filtro de Transações do Incorporador

## Problema
A migração anterior filtrou por `product_category = 'incorporador'`, mas isso está errado. O filtro correto deve usar a tabela `product_configurations` que vocês criaram em `/admin/produtos`, onde cada produto tem um `target_bu` definindo a qual Business Unit ele pertence.

## Números Corretos

| Filtro | Total de Transações |
|--------|---------------------|
| Filtro errado (`product_category`) | 433 |
| Filtro correto (`product_configurations`) | ~2.005 (janeiro/2026) |
| Histórico completo | 19.937 |

## Produtos Cadastrados para Incorporador (19 produtos ativos)

Conforme a tabela `product_configurations` com `target_bu = 'incorporador'`:

- 000 - Contrato
- A000 - Contrato
- A000 - Pré-Reserva Plano Anticrise
- A001 - MCF INCORPORADOR COMPLETO
- A001 - MCF INCORPORADOR COMPLETO + THE CLUB
- A002 - MCF INCORPORADOR BÁSICO
- A003 - MCF Plano Anticrise Completo
- A004 - MCF Plano Anticrise Básico
- A005 - MCF P2
- A006 - Renovação Parceiro MCF
- A008 - The CLUB
- A009 - MCF INCORPORADOR + THE CLUB
- A009 - MCF INCORPORADOR COMPLETO + THE CLUB
- A009 - MCF INCORPORADOR COMPLETO + THE CLUB - 1 de 12
- A009 - Renovação Parceiro MCF
- A010 - Construa para Vender sem Dinheiro
- A010 - Consultoria Construa para Vender sem Dinheiro + Treinamento
- A010 - MCF Fundamentos
- ACESSO VITALICÍO

## Solução

Modificar a função `get_all_hubla_transactions` para:

1. Fazer JOIN com `product_configurations`
2. Filtrar por `target_bu = 'incorporador'`
3. Manter exclusão de `newsale-` (duplicados)

## Detalhes Técnicos

### Nova Lógica SQL

```sql
FROM hubla_transactions ht
WHERE ht.sale_status IN ('completed', 'refunded')
  AND ht.source IN ('hubla', 'manual')
  AND ht.hubla_id NOT LIKE 'newsale-%'
  AND EXISTS (
    SELECT 1 FROM product_configurations pc 
    WHERE pc.target_bu = 'incorporador' 
      AND pc.is_active = true 
      AND ht.product_name = pc.product_name
  )
  -- filtros de data e busca...
```

### Vantagens desta abordagem

1. **Dinâmico**: Quando você adicionar um novo produto em `/admin/produtos` com `target_bu = 'incorporador'`, ele aparece automaticamente
2. **Centralizado**: A configuração fica em um só lugar (tabela `product_configurations`)
3. **Consistente**: Usa a mesma fonte de verdade que outras partes do sistema

## Implementação

1. Executar migração SQL para recriar a função `get_all_hubla_transactions` com JOIN na tabela `product_configurations`
