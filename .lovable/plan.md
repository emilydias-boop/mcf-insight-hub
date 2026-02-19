
# Corrigir Composição da BU Incorporador - Mapear Produtos Faltantes e Ajustar A010

## Problema

A pagina de Vendas do Incorporador nao inclui 3 categorias de produtos que deveriam estar la, e o A010 esta com liquido inflado por conta de order bumps.

### Produtos faltantes (nao mapeados na product_configurations como incorporador):
- **OB Construir Para Alugar**: 140 vendas, R$ 11.347 liquido
- **OB Acesso Vitalicio**: 154 vendas, R$ 7.408 liquido  
- **Imersao Presencial** (OB Evento): 10 vendas, R$ 2.682 liquido

### A010 inflado:
- Sistema mostra R$ 32.365 (684 registros) porque inclui 180 registros de order bump
- Planilha mostra R$ 23.258 (632 vendas) contando apenas vendas "main" completed
- Os "main completed" no sistema somam R$ 23.297 -- muito proximo do valor correto

## Solucao

### 1. Adicionar produtos faltantes na product_configurations (SQL Migration)

Inserir os 3 produtos com `target_bu = 'incorporador'` e categorias corretas:

```text
INSERT INTO product_configurations (product_name, target_bu, product_category)
VALUES 
  ('OB Construir Para Alugar', 'incorporador', 'ob_construir'),
  ('OB Acesso Vitalício', 'incorporador', 'ob_vitalicio'),
  ('Imersão Presencial', 'incorporador', 'ob_evento')
ON CONFLICT (product_name) DO UPDATE 
  SET target_bu = 'incorporador',
      product_category = EXCLUDED.product_category;
```

Com isso esses produtos passam a aparecer na pagina de Vendas MCF Incorporador automaticamente (a RPC ja faz INNER JOIN com product_configurations WHERE target_bu = 'incorporador').

### 2. Verificar se o A010 precisa de ajuste

O liquido inflado do A010 vem dos order bumps (offers). O agrupamento por compra (fix anterior) ja trata isso na tabela, mas o total no card pode estar somando os offers.

**Investigacao necessaria**: Verificar se os 180 offers do A010 sao realmente order bumps (hubla_id com `-offer-`) e se o fix anterior de groupTransactionsByPurchase ja esta excluindo o main corretamente para o calculo do liquido total.

Se os offers nao sao agrupados com um main (porque o A010 nao tem um produto "pai"), cada offer pode estar sendo contado individualmente no total. Nesse caso, pode ser necessario excluir os offers de A010 ou trata-los de outra forma.

## Resultado Esperado

Apos as mudancas:
- OB Construir, OB Vitalicio e OB Evento aparecerao na pagina de Vendas
- O liquido total subira em ~R$ 21.438 (soma dos 3 produtos faltantes)
- O bruto e liquido por categoria ficarao consistentes com a planilha
- O total geral da BU Incorporador estara mais preciso
