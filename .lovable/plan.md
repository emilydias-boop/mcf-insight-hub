

## Etapa 2: Melhorias e funcionalidades faltantes do módulo de Cobrança

### O que já existe
- 5 tabelas criadas com RLS
- Aba Cobranças com KPIs, filtros básicos, tabela e drawer de detalhe
- Criar assinatura + gerar parcelas
- Criar acordo + gerar parcelas do acordo
- Marcar parcela como paga (1 clique)
- Cancelar/quitar assinatura
- Histórico de movimentações

### O que falta (escopo desta etapa)

**1. Editar Assinatura** — `EditSubscriptionModal.tsx`
- Permitir alterar dados do contrato (responsável, observações, forma de pagamento, produto)
- Botão "Editar" no drawer do detalhe

**2. Registrar Pagamento com detalhes** — `RegisterPaymentModal.tsx`
- Modal para registrar pagamento com campos: valor pago, data do pagamento, forma de pagamento, observações
- Diferente do "Marcar como paga" (1 clique com valor cheio), este permite valor parcial, data retroativa, etc.
- Acessível via botão no drawer

**3. Parcelas do Acordo visíveis** — Expandir `CobrancaAgreements.tsx`
- Mostrar as parcelas de cada acordo (billing_agreement_installments) dentro do card do acordo
- Permitir marcar parcela do acordo como paga
- Botão para editar status do acordo (em_andamento → cumprido/quebrado)

**4. Editar Acordo** — `EditAgreementModal.tsx`
- Alterar status, observações, responsável de um acordo existente

**5. Adicionar Observação ao Histórico**
- Botão no drawer para adicionar nota/observação manual ao histórico (tipo `observacao`)
- Input inline ou mini-modal

**6. Filtros avançados nos CobrancaFilters**
- Filtro por range de vencimento (data de/até)
- Toggle "Inadimplentes" (status = atrasada)
- Toggle "Quitados" (status_quitacao = quitado)

**7. Confirmação para ações destrutivas**
- AlertDialog antes de cancelar assinatura ou quitar contrato

### Componentes a criar/editar

| Ação | Arquivo |
|------|---------|
| Criar | `EditSubscriptionModal.tsx` |
| Criar | `RegisterPaymentModal.tsx` |
| Criar | `EditAgreementModal.tsx` |
| Editar | `CobrancaAgreements.tsx` — expandir com parcelas do acordo e ações |
| Editar | `CobrancaDetailDrawer.tsx` — adicionar botões Editar, Registrar Pagamento, Observação |
| Editar | `CobrancaFilters.tsx` — adicionar filtros de data e toggles |
| Editar | `useBillingSubscriptions.ts` — suportar filtros de vencimento via join com installments |
| Criar | Hook `useMarkAgreementInstallmentPaid` em `useBillingAgreements.ts` |

### Sem alterações de schema
Todas as tabelas e campos necessários já existem. Esta etapa é 100% frontend.

