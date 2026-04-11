

# Plano: Evolução da Tela de Cobranças para Visão Financeira

## Objetivo
Transformar a tela de cobranças de uma visão de gestão de assinaturas para uma visão de **fluxo de caixa mensal** (previsto vs realizado), com controle de exceções e rastreabilidade por cliente.

## O que muda

A tela atual mostra assinaturas e seus status. A nova versão foca nas **parcelas do mês**, mostrando o que cada cliente deve pagar naquele período, com controle de reembolsos e exclusões.

---

## Estrutura da Nova Interface

### Layout Principal
- Seletor de mês (mantido) + **novo filtro por semana** dentro do mês
- 3 abas: **Cobranças** (principal) | **Reembolsos** | **Resumo Anual**
- KPIs do mês: Valor Estimado de Recebimento e Valor Efetivamente Recebido

### Aba "Cobranças" -- Tabela por parcela do mês

Cada linha = uma parcela com vencimento no mês selecionado:

| Coluna | Fonte |
|--------|-------|
| Cliente (nome + telefone) | `billing_subscriptions.customer_name/phone` |
| Saldo devedor no mês | Soma de parcelas pendentes/atrasadas do mês para aquela subscription |
| Status | `billing_installments.status` (pago/pendente/atrasado/reembolso/cancelado) |
| Data da cobrança | `billing_installments.data_vencimento` |
| Entrada (valor + método) | `billing_subscriptions.valor_entrada` + `forma_pagamento` |
| Restante (tipo) | Derivado de `total_parcelas` e `forma_pagamento` |
| Link enviado (assinaturas) | Novo campo na subscription ou installment |

### Aba "Reembolsos"
- Lista parcelas marcadas como "reembolso" no mês
- Esses valores são subtraidos do estimado

### Aba "Resumo Anual"
- Grid 12 meses com: Total Previsto, Recebido, Em Risco, Reembolsado

---

## Implementação Técnica (6 passos)

### Passo 1: Migração SQL -- Novos campos e status

Adicionar à tabela `billing_installments`:
- Novo enum value `reembolso` e `nao_sera_pago` ao tipo `billing_installment_status`
- Campo `exclusao_motivo` (text, nullable) para registrar por que foi excluído do fluxo

Adicionar à tabela `billing_subscriptions`:
- Campo `link_assinatura_enviado` (boolean, default false) para controle de envio de link

### Passo 2: Hook `useBillingMonthInstallments` (novo)

Busca parcelas do mês agrupadas por cliente, com dados enriquecidos da subscription (telefone, entrada, forma de pagamento). Suporta filtro por semana (semana 1-4 derivada da data de vencimento). Calcula KPIs: estimado (excluindo reembolso/nao_sera_pago) e recebido.

### Passo 3: Componente `CobrancaMonthTable` (novo)

Nova tabela focada em parcelas do mês (não em subscriptions como hoje). Colunas: Cliente+Telefone, Saldo Devedor Mês, Status, Data Cobrança, Entrada, Restante, Link Enviado (se assinatura).

### Passo 4: Componente `CobrancaReembolsosTab` (novo)

Filtra parcelas com status `reembolso` no mês. Mostra lista com cliente, valor, data e motivo.

### Passo 5: Componente `CobrancaResumoAnual` (novo)

Busca dados de jan-dez do ano corrente. Grid com cards mensais mostrando: Previsto, Recebido, Em Risco (atrasado), Reembolsado.

### Passo 6: Refatorar `FinanceiroCobrancas.tsx`

- Substituir tabs atuais (Cobranças/Acordos) por 3 tabs (Cobranças/Reembolsos/Resumo Anual)
- Mover Acordos para dentro do drawer de detalhes ou subtab
- Adicionar filtro de semana ao lado do seletor de mês
- Atualizar KPIs para mostrar Estimado vs Recebido
- Ações de "Marcar como Reembolso" e "Não será pago" nas linhas da tabela

### Nota sobre dados existentes

Os dados já disponíveis no banco cobrem: nome, telefone, valor_entrada, forma_pagamento, parcelas com vencimento/valor/status. Os novos campos (exclusao_motivo, link_enviado) são opcionais e não quebram a interface existente.

