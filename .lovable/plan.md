

# Fix: KPIs devem acompanhar a aba ativa (Assinaturas / Parcelados)

## Problema
Os KPIs globais (`CobrancaKPIs`) e os KPIs do mes (`CobrancaMonthKPIs`) buscam dados de **todas** as subscriptions, sem filtrar pelo tipo da aba ativa (assinatura vs parcelado). Ambas as abas mostram os mesmos valores.

## Correção

### 1. `useBillingMonthKPIs.ts` — filtrar por tipo
- Receber novo parametro `subscriptionType: 'assinatura' | 'parcelado' | undefined`
- Antes de calcular, buscar os `subscription_id`s que pertencem ao tipo correto (join com `billing_subscriptions` filtrando por `product_category` usando a logica de `getSubscriptionType` / `PARCELADO_CATEGORIES`)
- Filtrar installments apenas dos subscription_ids do tipo ativo

### 2. `useBillingKPIs` em `useBillingSubscriptions.ts` — filtrar por tipo
- Receber novo parametro `subscriptionType: 'assinatura' | 'parcelado' | undefined`
- Adicionar filtro na query de subscriptions: para 'parcelado', filtrar `product_category` in PARCELADO_CATEGORIES; para 'assinatura', filtrar NOT in PARCELADO_CATEGORIES
- Filtrar installments correspondentes

### 3. `FinanceiroCobrancas.tsx` — passar aba ativa
- Passar `activeTab` para os hooks `useBillingKPIs(currentMonth, activeTab)` e `useBillingMonthKPIs(currentMonth, activeTab)`
- Mapear `activeTab` ('assinaturas' -> 'assinatura', 'parcelados' -> 'parcelado', 'acordos' -> undefined)

Resultado: cada aba mostra KPIs exclusivos do seu tipo de subscription.

