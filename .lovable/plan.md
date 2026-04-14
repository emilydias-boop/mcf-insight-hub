

## Diagnostico: Relatório Semanal `weekly-bu-report`

### Problemas encontrados

A edge function `weekly-bu-report` está consultando **colunas que não existem** na tabela `weekly_metrics`:

```text
Colunas consultadas (INEXISTENTES):    Colunas reais no banco:
─────────────────────────────────      ─────────────────────
origin_name                            start_date / end_date
leads_count                            a010_sales / contract_sales
meetings_scheduled                     faturamento_total / total_revenue
deals_won                              ads_cost / total_cost
revenue                                roi / roas / clint_revenue
```

**Resultado**: O Supabase retorna `null` para todas essas colunas, gerando um email com todos os valores **zerados** (0 leads, 0 reuniões, 0 vendas, R$ 0,00).

Além disso, a semana do relatório usa segunda a domingo, mas os `weekly_metrics` usam **sábado a sexta** — o filtro por `week_start` nunca vai bater.

### Plano de correção

**Arquivo**: `supabase/functions/weekly-bu-report/index.ts`

1. **Corrigir a query de `weekly_metrics`**: Usar `start_date`/`end_date` e os campos reais (`a010_sales`, `contract_sales`, `faturamento_total`, `ads_cost`, `total_cost`, `roi`, `roas`, `incorporador_50k`, `clint_revenue`, etc.)

2. **Ajustar o range de data**: Em vez de procurar por `week_start`, buscar a semana cujo `start_date` cai dentro do periodo (a semana customizada sáb-sex mais recente completada)

3. **Buscar dados de Consórcio**: Usar `consortium_cards` com `created_at` no periodo (já funciona, mas sem dados recentes)

4. **Adicionar dados de Crédito**: Buscar transações de crédito de `hubla_transactions` onde `product_category = 'credito'`

5. **Melhorar o HTML do email**: Mostrar as métricas reais do negócio:
   - **Incorporador**: Vendas A010, Contratos, Faturamento, Incorporador 50K, ROI, ROAS
   - **Consórcio**: Cartas vendidas, valor de crédito
   - **Crédito**: Vendas e receita

6. **Adicionar KPIs financeiros**: ROI, ROAS, Custo total, Lucro operacional — dados que já existem na tabela

### Resultado esperado

O email semanal chegará com os dados reais do dashboard em vez de zeros, mostrando a performance consolidada das 3 BUs com métricas financeiras relevantes.

