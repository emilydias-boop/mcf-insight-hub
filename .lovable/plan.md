
# Plano: Corrigir Mapeamento de Produtos entre BUs

## Diagnóstico

Existem **3 categorias de problemas** nos mapeamentos de produtos:

1. **Produtos Consórcio desaparecidos da `product_configurations`**
   - "Imersão: Do Zero ao Milhão" (1.178 transações) está totalmente ausente
   - Causa: Vendas do Consórcio aparecem como "Sem Responsável" no Incorporador

2. **Produtos com categorias inconsistentes na `product_configurations`**
   - "Construir Para Alugar" tem `category = outros` (deveria ser `ob_construir_alugar`)
   - Vários "A000 - Contrato" têm `category = incorporador` (deveria ser `contrato`)

3. **Produtos com categorias NULL na `hubla_transactions`**
   - "A005 - MCF P2" (10 txs) e "A009 - MCF INCORPORADOR + THE CLUB" (7 txs)
   - Causa: Não encontram match em `product_configurations` ou vinculação manual ausente

## Solução em 3 Passos

### 1️⃣ Registrar "Imersão: Do Zero ao Milhão" em `product_configurations`
- `product_name`: "Imersão: Do Zero ao Milhão na Construção"
- `product_code`: null
- `product_category`: "imersao"
- `target_bu`: "consorcio"
- `reference_price`: 497 (preço médio observado)
- `is_active`: true
- `count_in_dashboard`: true

### 2️⃣ Corrigir categorias em `product_configurations` (via UPDATE)
- "Construir Para Alugar" → category: `ob_construir_alugar` (já é Consórcio)
- "A000 - Contrato" → category: `contrato` (está como `incorporador`)

### 3️⃣ Corrigir categorias NULL em `hubla_transactions`
- "A005 - MCF P2" → category: `incorporador` (baseado na config)
- "A009 - MCF INCORPORADOR + THE CLUB" → category: `incorporador`

## Resultado Esperado
- ✅ Produtos de Consórcio não poluem mais o "Sem Responsável" do Incorporador
- ✅ Todas as 1.178 transações de "Imersão" serão categorizadas corretamente
- ✅ Contratos A000 terão categoria consistente
- ✅ Relatórios de Incorporador mostram apenas produtos do Incorporador

## SQL a Executar

```sql
-- 1. Adicionar Imersão à product_configurations (Consórcio)
INSERT INTO product_configurations (product_name, product_code, product_category, target_bu, reference_price, count_in_dashboard, is_active)
VALUES ('Imersão: Do Zero ao Milhão na Construção', NULL, 'imersao', 'consorcio', 497, true, true);

-- 2. Corrigir categorias em product_configurations
UPDATE product_configurations
SET product_category = 'contrato'
WHERE product_name LIKE 'A000 - Contrato%' AND product_category = 'incorporador';

UPDATE product_configurations
SET product_category = 'ob_construir_alugar'
WHERE product_name = 'Construir Para Alugar' AND target_bu = 'consorcio';

-- 3. Corrigir categorias NULL em hubla_transactions
UPDATE hubla_transactions
SET product_category = 'incorporador'
WHERE product_name = 'A005 - MCF P2' AND product_category IS NULL;

UPDATE hubla_transactions
SET product_category = 'incorporador'
WHERE product_name = 'A009 - MCF INCORPORADOR + THE CLUB' AND product_category IS NULL;
```

## Impacto Financeiro
- **Imersão**: 1.178 txs × R$ 47 (preço médio) = ~R$ 55k removido de "Sem Closer"
- **Contrato A000**: 518 txs continuam no Incorporador, categoria corrigida
- **Total corrigido**: ~1.700 transações reclassificadas
