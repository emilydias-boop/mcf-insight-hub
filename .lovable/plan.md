

# Separar Cobranças em 3 Abas: Parcelados, Assinaturas e Acordos

## Contexto
Hoje a página de Cobranças mostra tudo misturado em uma tabela. O objetivo e separar em 3 abas com propósitos distintos baseando-se nos dados existentes da tabela `billing_subscriptions`.

## Lógica de classificação (client-side, sem migration)

Usando `product_category` e `forma_pagamento` para derivar o tipo:

- **Assinaturas**: `product_category` em `['a010', 'incorporador', 'ob_vitalicio', 'ob_construir_alugar', 'efeito_alavanca', 'clube_arremate', 'imersao', 'imersao_socios', 'projetos', 'outros']` -- essencialmente, produtos recorrentes vindos de plataformas
- **Parcelados**: `product_category` em `['contrato', 'renovacao', 'contrato_clube_arremate']` -- contratos A000, renovações A006, pagamentos com entrada + parcelas em boleto
- **Acordos**: Registros da tabela `billing_agreements` (já existente), incluindo renegociações e acordos manuais feitos a partir do carrinho

## Alterações

### 1. `src/components/financeiro/cobranca/FinanceiroCobrancas.tsx`
- Adicionar `Tabs` (shadcn) com 3 abas: **Assinaturas**, **Parcelados**, **Acordos**
- Cada aba filtra `subscriptions` pela classificação acima
- KPIs globais (topo) permanecem mostrando o total
- Filtros e tabela ficam dentro de cada aba
- A aba "Acordos" usa dados de `billing_agreements` (hook `useBillingAgreements`) com listagem própria, permitindo criar acordos e ver parcelas/pagamentos

### 2. `src/types/billing.ts`
- Adicionar helper `getSubscriptionType(sub: BillingSubscription): 'assinatura' | 'parcelado'`
- Constante com as categorias de cada tipo

### 3. Aba "Acordos" - Novo componente `CobrancaAcordosTab.tsx`
- Lista todos os `billing_agreements` com filtro por status e busca
- Mostra: cliente (via subscription), valor negociado, parcelas, status, responsável
- Permite criar novo acordo e ver detalhes/parcelas expandidas
- Botão "Novo Acordo" que abre o `CreateAgreementModal` existente (adaptado para buscar a subscription)

### 4. Layout final

```text
[Alertas + Histórico + KPIs globais + Fila de Cobrança]

[📋 Assinaturas] [💳 Parcelados] [🤝 Acordos]    ← Tabs com contadores

--- Conteúdo da aba ativa ---
[Month selector + Exportar + Sync + Nova Assinatura]
[Month KPIs filtrados pela aba]
[Filtros]
[Tabela filtrada]
```

### Detalhes técnicos
- A classificação é feita com `useMemo` sobre `subscriptions` já carregadas, sem queries adicionais
- Os contadores das abas mostram quantas subscriptions de cada tipo existem
- A aba Acordos faz query separada em `billing_agreements` com join para pegar nome do cliente
- Os KPIs do mês (MonthKPIs) e a fila de cobrança permanecem acima das abas como visão global

