
# Adicionar "A000 - Contrato MCF" na Configuracao de Produtos

## Problema

O produto **"A000 - Contrato MCF"** (97 transacoes no banco, 41 faturas na Hubla em Janeiro) nao aparece na pagina de Vendas do Incorporador porque nao esta cadastrado na tabela `product_configurations`.

A tabela tem apenas "A000 - Contrato" (target_bu: incorporador), mas a Hubla esta gerando faturas com o nome "A000 - Contrato MCF". A RPC `get_incorporador_transactions` usa essa tabela para filtrar quais produtos pertencem ao Incorporador, entao esses contratos sao invisíveis.

## Solucao

Adicionar uma nova entrada na tabela `product_configurations` para o produto "A000 - Contrato MCF" com os mesmos parametros do "A000 - Contrato" existente:

- `product_name`: A000 - Contrato MCF
- `product_code`: A000
- `product_category`: contrato
- `target_bu`: incorporador
- `reference_price`: 497
- `count_in_dashboard`: true
- `is_active`: true

Alem disso, corrigir a `product_category` das 97 transacoes existentes de `incorporador` para `contrato` (para manter consistencia com o "A000 - Contrato" original).

## Alteracoes

### 1. Migracao SQL (INSERT + UPDATE)

```text
-- Adicionar produto na configuracao
INSERT INTO product_configurations (product_name, product_code, product_category, target_bu, reference_price, count_in_dashboard, is_active)
VALUES ('A000 - Contrato MCF', 'A000', 'contrato', 'incorporador', 497, true, true);

-- Corrigir category das transacoes existentes
UPDATE hubla_transactions
SET product_category = 'contrato'
WHERE product_name = 'A000 - Contrato MCF'
  AND product_category = 'incorporador';
```

### 2. Nenhuma alteracao de codigo

A RPC e o frontend ja estao preparados para lidar com novos produtos via `product_configurations`. Basta o registro existir na tabela.

## Resultado Esperado

- Pagina de Vendas do Incorporador mostrara os contratos "A000 - Contrato MCF"
- Busca por "A000 - Contrato MCF" retornara as 41+ transacoes do periodo
- Relatorio de Faturamento por Closer incluira essas transacoes corretamente
