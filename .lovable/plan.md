

## Plano: Adicionar coluna "Acordo" na aba Vendas do Carrinho R2

### Objetivo
Mostrar na tabela de vendas o status do acordo de parceria de cada cliente, e permitir criar/visualizar acordos diretamente.

### Como funciona a ligação
- Vendas têm `customer_email`
- `billing_subscriptions` tem `customer_email` e `deal_id`
- `billing_agreements` ligam via `subscription_id`
- Reutilizar o padrão batch do `useAprovadoAgreementsBatch` mas indexado por email em vez de deal_id

### Alterações

| Arquivo | O que muda |
|---------|------------|
| `src/hooks/useAprovadoAgreements.ts` | Novo hook `useAgreementsByEmails(emails[])` — batch query: busca subscriptions por email, depois agreements, retorna Map<email, {status, parcelas, saldo}> |
| `src/components/crm/R2VendasList.tsx` | (1) Importar novo hook + `CreateAgreementModal`. (2) Extrair emails das vendas e chamar `useAgreementsByEmails`. (3) Adicionar coluna "Acordo" na tabela com badge de status. (4) Botão "Novo Acordo" quando tem subscription mas sem acordo. (5) Botão "Ver" que redireciona para `/cobrancas`. |

### Nova coluna "Acordo" na tabela

Após a coluna "Fonte", antes de "Ações":
- **Sem subscription**: mostrar `-` (cinza)
- **Com subscription, sem acordo**: Badge "Sem acordo" (cinza) + ícone de criar
- **Acordo em aberto/andamento**: Badge azul "Em andamento 2/6" (parcelas pagas/total)
- **Acordo cumprido**: Badge verde "Cumprido"
- **Acordo quebrado**: Badge vermelho "Quebrado"

### Hook `useAgreementsByEmails`

```typescript
export function useAgreementsByEmails(emails: string[]) {
  // 1. billing_subscriptions WHERE customer_email IN (emails)
  // 2. billing_agreements WHERE subscription_id IN (sub_ids)  
  // 3. billing_agreement_installments para contar pagas/total
  // Return: Map<email, { subscriptionId, status, parcelasPagas, totalParcelas }>
}
```

### Ações na coluna
- Clique no badge abre o drawer de cobrança (`/cobrancas`) com filtro do cliente
- Botão "+" para criar acordo abre `CreateAgreementModal` com `subscriptionId` preenchido

### KPIs
Adicionar um 5o KPI card: **"Com Acordo"** — contagem de vendas que possuem acordo ativo.

