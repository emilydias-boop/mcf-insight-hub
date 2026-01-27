
# Plano: Corrigir Erro da Função RPC (column pc.original_name does not exist)

## Problema Identificado

A migration anterior criou as funções RPC com referência à coluna `pc.original_name`, mas essa coluna **não existe** na tabela `product_configurations`. A coluna correta é `pc.product_name`.

### Erro Atual
```
column pc.original_name does not exist
```

### Estrutura Real da Tabela `product_configurations`
| Coluna | Tipo |
|--------|------|
| product_name | text |
| product_code | text |
| display_name | text |
| target_bu | text |
| reference_price | numeric |
| ... | ... |

## Solução

Recriar as funções RPC corrigindo a referência `pc.original_name` para `pc.product_name`, e simplificando a lógica para manter compatibilidade com a versão anterior que funcionava.

## Alteração Técnica

### Migration SQL Corretiva

A nova migration vai:
1. Dropar as funções com erro
2. Recriar usando a estrutura que funcionava antes (migration `20260127152906`)
3. Adicionar apenas o campo `hubla_id` ao retorno

### Principais Mudanças

| Antes (com erro) | Depois (corrigido) |
|------------------|-------------------|
| `LOWER(ht.product_name) = LOWER(pc.original_name)` | `ht.product_name = pc.product_name` |
| Lógica complexa com child_offer_ids | Lógica simples do JOIN original |
| `pc.product_code` como product_category | `ht.product_category` direto |

### Campos Retornados

```sql
RETURNS TABLE(
  id uuid,
  hubla_id text,  -- Campo adicionado para agrupamento
  product_name text,
  product_category text,
  product_price numeric,
  net_value numeric,
  customer_name text,
  customer_email text,
  customer_phone text,
  sale_date timestamptz,
  sale_status text,
  installment_number integer,
  total_installments integer,
  source text,
  gross_override numeric
)
```

## Resultado Esperado

Após a correção:
- As transações voltarão a aparecer normalmente
- O campo `hubla_id` estará disponível para o agrupamento
- A lógica de consolidação (parent + order bumps) funcionará corretamente
