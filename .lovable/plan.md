

## Página de Cobrança / Financeiro

### Contexto atual

O sistema hoje tem a página `/financeiro` com 3 abas (Pagamentos PJ, Transações, Receitas). Os dados de transações vêm da tabela `hubla_transactions`, que registra cada parcela individualmente com `installment_number`, `total_installments`, `product_price`, `net_value`, `payment_method` e `customer_email`. Não existem tabelas dedicadas para assinaturas, acordos ou histórico de cobrança.

### Novas tabelas (migrations)

**1. `billing_subscriptions`** — Controle de assinaturas/contratos por lead
- `id`, `customer_email`, `customer_name`, `customer_phone`
- `deal_id` (FK → crm_deals, nullable), `contact_id` (FK → crm_contacts, nullable)
- `product_name`, `product_category`
- `valor_entrada`, `valor_total_contrato`
- `total_parcelas`, `forma_pagamento` (pix, credit_card, bank_slip, boleto)
- `status` enum: `em_dia`, `atrasada`, `cancelada`, `finalizada`, `quitada`
- `status_quitacao` enum: `em_aberto`, `parcialmente_pago`, `quitado`
- `data_inicio`, `data_fim_prevista`
- `responsavel_financeiro` (text, quem cuida dessa cobrança)
- `observacoes`, `created_at`, `updated_at`, `created_by`, `updated_by`

**2. `billing_installments`** — Parcelas individuais de cada assinatura
- `id`, `subscription_id` (FK → billing_subscriptions)
- `numero_parcela`, `valor_original`, `valor_pago`, `valor_liquido`
- `data_vencimento`, `data_pagamento`
- `forma_pagamento`, `status` enum: `pendente`, `pago`, `atrasado`, `cancelado`
- `hubla_transaction_id` (FK → hubla_transactions, nullable — vincula com transação real)
- `observacoes`, `created_at`, `updated_at`

**3. `billing_agreements`** — Acordos/negociações feitos pelo financeiro
- `id`, `subscription_id` (FK → billing_subscriptions)
- `responsavel` (quem fez o acordo — Bruna, Leticia, etc.)
- `data_negociacao`
- `motivo_negociacao`
- `valor_original_divida`, `novo_valor_negociado`
- `quantidade_parcelas`, `forma_pagamento`
- `data_primeiro_vencimento`
- `status` enum: `em_aberto`, `em_andamento`, `cumprido`, `quebrado`
- `observacoes`, `created_at`, `updated_at`, `created_by`

**4. `billing_agreement_installments`** — Parcelas do acordo
- `id`, `agreement_id` (FK → billing_agreements)
- `numero_parcela`, `valor`, `data_vencimento`, `data_pagamento`
- `status` enum: `pendente`, `pago`, `atrasado`
- `created_at`, `updated_at`

**5. `billing_history`** — Histórico completo de movimentações
- `id`, `subscription_id` (FK → billing_subscriptions)
- `tipo` enum: `entrada_paga`, `parcela_paga`, `parcela_atrasada`, `boleto_gerado`, `tentativa_cobranca`, `acordo_realizado`, `cancelamento`, `quitacao`, `observacao`
- `valor`, `forma_pagamento`
- `status`, `responsavel` (quem executou a ação)
- `descricao` (texto livre)
- `metadata` (jsonb — dados extras)
- `created_at`

Todas com RLS habilitado + políticas para roles `admin` e `financeiro`.

### Nova aba na página Financeiro

Adicionar uma 4ª aba **"Cobranças"** na página `/financeiro` existente.

### Estrutura da aba Cobranças

**Bloco 1 — KPIs de resumo (topo)**
- Valor total contratado (soma de `valor_total_contrato`)
- Valor total pago (soma dos `billing_installments` com status `pago`)
- Saldo devedor (contratado - pago)
- Assinaturas ativas / atrasadas / quitadas
- Parcelas pagas vs totais

**Bloco 2 — Filtros**
- Status da assinatura (em_dia, atrasada, cancelada, finalizada, quitada)
- Status da cobrança (pendente, pago, atrasado)
- Forma de pagamento
- Responsável do financeiro
- Vencimento (range de datas)
- Com acordo ativo (sim/não)
- Inadimplentes
- Quitados

**Bloco 3 — Lista de assinaturas** (tabela principal)
- Nome, email, produto, status, parcelas (X/Y pagas), saldo devedor, próximo vencimento
- Badge colorido de status (verde = quitado, vermelho = atrasado, amarelo = em acordo)
- Linha expansível ou click para abrir detalhe

**Bloco 4 — Drawer/Modal de detalhe do lead** (ao clicar numa assinatura)
- Resumo financeiro do lead
- Status da assinatura com destaque visual
- Grid de parcelas com status individual
- Seção de acordos/negociações
- Histórico completo de movimentações
- Ações rápidas: Registrar pagamento, Marcar parcela como paga, Criar acordo, Editar acordo, Cancelar assinatura, Finalizar contrato

### Componentes a criar

```text
src/components/financeiro/cobranca/
├── FinanceiroCobrancas.tsx          (aba principal)
├── CobrancaKPIs.tsx                 (cards de resumo)
├── CobrancaFilters.tsx              (filtros)
├── CobrancaTable.tsx                (tabela de assinaturas)
├── CobrancaDetailDrawer.tsx         (drawer com detalhe do lead)
├── CobrancaInstallments.tsx         (grid de parcelas)
├── CobrancaAgreements.tsx           (seção acordos)
├── CobrancaHistory.tsx              (histórico)
├── CreateSubscriptionModal.tsx      (criar assinatura)
├── CreateAgreementModal.tsx         (criar acordo)
├── RegisterPaymentModal.tsx         (registrar pagamento)
└── EditAgreementModal.tsx           (editar acordo)
```

### Hooks

```text
src/hooks/
├── useBillingSubscriptions.ts       (CRUD assinaturas + filtros)
├── useBillingInstallments.ts        (parcelas)
├── useBillingAgreements.ts          (acordos)
├── useBillingHistory.ts             (histórico)
└── useBillingKPIs.ts                (métricas agregadas)
```

### Lógica de negócio

- Ao marcar uma parcela como paga, o sistema cria registro no `billing_history` e atualiza contadores
- Quando todas as parcelas estiverem pagas, o `status_quitacao` muda automaticamente para `quitado` e a assinatura sai dos filtros de cobranças futuras
- Parcelas com `data_vencimento < hoje` e `status = pendente` são automaticamente marcadas como `atrasado` (via query ou trigger)
- Assinaturas quitadas ficam com destaque verde grande e visível
- Parcelas atrasadas com destaque vermelho

### Escopo da implementação

Dado o tamanho, a implementação será dividida em etapas:
1. Criar as 5 tabelas com migrations + RLS
2. Criar a aba Cobranças com KPIs, filtros e tabela principal
3. Criar o drawer de detalhe com parcelas
4. Criar modais de ações (registrar pagamento, criar assinatura)
5. Criar a seção de acordos e histórico

