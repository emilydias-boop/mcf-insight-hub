

# Unificar abas de Cobranças em uma só

## Problema
Todos os 5 produtos permitidos têm `product_category = 'incorporador'`, que cai na aba "Assinaturas". A aba "Parcelados" fica vazia. O usuário quer tudo em uma aba única.

## Alterações

### `src/components/financeiro/cobranca/FinanceiroCobrancas.tsx`

1. Remover as abas "Assinaturas" e "Parcelados" — manter apenas "Acordos" como aba separada
2. Remover a separação `assinaturas`/`parcelados` via `getSubscriptionType` — usar `subscriptions` direto
3. Remover o state `activeTab` e a lógica de `subType` — KPIs passam `undefined` (sem filtro de tipo)
4. Renderizar o conteúdo principal (month selector, KPIs do mês, filtros, tabela) diretamente, com a aba "Acordos" abaixo ou como toggle

### `src/hooks/useBillingSubscriptions.ts` e `src/hooks/useBillingMonthKPIs.ts`

- Remover o parâmetro `subscriptionType` dos hooks de KPIs (ou ignorá-lo) — não há mais necessidade de filtrar por tipo

Layout final: conteúdo único com todos os produtos + seção de Acordos acessível via aba ou botão.

