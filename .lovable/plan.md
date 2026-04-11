

# Plano: Adicionar filtro de Parceria na tela de Cobranças

## O que será feito

Substituir os componentes `CobrancaAlertPanel` e `CobrancaHistoryPanel` por um **filtro de produto/parceria** no estilo do CRM, permitindo filtrar as parcelas do mês por produto (ex: Incorporador Completo, Anticrise, etc.).

## Alterações

### 1. `FinanceiroCobrancas.tsx`
- Remover imports e uso de `CobrancaAlertPanel`, `CobrancaHistoryPanel`, `useBillingCobrancaAlerts`
- Remover variáveis `billingAlerts`, `loadingBillingAlerts`, `billingAlertItems`
- Adicionar state `productFilter` (string, default `'todos'`)
- Adicionar um `Select` de produto ao lado dos filtros de mês/semana, com opções derivadas dos `ALLOWED_BILLING_PRODUCTS` (agrupados por tipo: Incorporador / Anticrise)
- Filtrar `rows` client-side pelo `product_name` selecionado antes de renderizar tabela e KPIs

### 2. Filtro de produto
Opções:
- "Todos os produtos"
- Incorporador (agrupa A001, A002, A009)
- Anticrise (agrupa A003, A004)
- Cada produto individual

O filtro será aplicado client-side sobre os dados já retornados pelo hook, recalculando KPIs e contadores das tabs.

