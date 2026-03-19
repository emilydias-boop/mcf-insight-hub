

## Plano: Filtrar tabela e KPIs gerais pelo mês selecionado

### Problema
O seletor de mês só afeta os 4 KPI cards do mês (Recebido, Pendente, Atrasado, Taxa). A tabela de assinaturas e os KPIs gerais do topo (Total Contratado, Total Pago, Saldo Devedor, etc.) ignoram completamente o mês selecionado.

### Solução
Filtrar as assinaturas exibidas na tabela para mostrar apenas aquelas que possuem **parcelas com vencimento no mês selecionado**. Isso requer uma abordagem diferente: buscar os `subscription_id` distintos das parcelas do mês e depois filtrar a tabela.

### Mudanças

**1. `src/hooks/useBillingSubscriptions.ts`**
- Adicionar `month` (Date opcional) ao `BillingFilters`
- Quando `month` estiver definido, primeiro buscar `billing_installments` com `data_vencimento` no range do mês para obter os `subscription_id` distintos
- Filtrar a query de subscriptions usando `.in('id', subscriptionIds)`
- Fazer o mesmo para `useBillingKPIs`: receber `month` e filtrar parcelas/assinaturas pelo mês

**2. `src/types/billing.ts`**
- Adicionar `month?: Date` ao `BillingFilters`

**3. `src/components/financeiro/cobranca/FinanceiroCobrancas.tsx`**
- Passar `currentMonth` nos filters: `useBillingSubscriptions({ ...filters, month: currentMonth })`
- Passar `currentMonth` para `useBillingKPIs(currentMonth)`

### Resultado
Ao trocar o mês, a tabela mostrará apenas assinaturas com parcelas naquele mês, e os KPIs gerais refletirão os totais filtrados.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/types/billing.ts` | Adicionar `month?: Date` ao `BillingFilters` |
| `src/hooks/useBillingSubscriptions.ts` | Filtrar subscriptions por parcelas do mês; KPIs filtrados por mês |
| `src/components/financeiro/cobranca/FinanceiroCobrancas.tsx` | Passar `currentMonth` para hooks |

