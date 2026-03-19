

## Plano: Pagamento Parcelado com Sub-Parcelas de Recebimento

### Contexto
Hoje o sistema só marca uma parcela como "paga" com valor fixo. O usuário precisa:
1. Registrar pagamentos parcelados (boleto parcelado, cartão parcelado, PIX parcelado)
2. Criar sub-parcelas de recebimento (quando o dinheiro vai cair de fato)
3. Complemento: redistribuir saldo, mostrar devedor, e permitir edição manual das parcelas restantes

### Mudanças no Banco de Dados

**1. Novos valores no enum `billing_payment_method`:**
- `boleto_parcelado`
- `cartao_parcelado`
- `pix_parcelado`

**2. Nova tabela `billing_payment_receivables`** (sub-parcelas de recebimento):
```
id, installment_id (FK billing_installments), numero, valor, data_prevista, 
data_recebimento, status (pendente/recebido), forma_pagamento, observacoes, 
created_at, updated_at
```

Essa tabela rastreia quando cada parcela do cartão/boleto/PIX vai compensar.

### Mudanças no Frontend

**1. Expandir `RegisterPaymentModal`** — reescrever como modal completo:
- Ao selecionar forma parcelada (cartão parcelado, boleto parcelado, PIX parcelado), aparece campo "Em quantas vezes?"
- Gera automaticamente as sub-parcelas de recebimento com datas mensais
- Marca a parcela original como "paga" e cria os receivables

**2. Complemento das parcelas restantes** — 3 opções no modal:
- Botão "Redistribuir saldo" — divide o valor não pago nas parcelas futuras pendentes
- Exibe o saldo devedor atualizado em tempo real
- Botão "Editar parcelas" no drawer de detalhes — permite alterar valor_original de parcelas pendentes manualmente

**3. Atualizar `CobrancaInstallments`:**
- Mostrar ícone/indicador quando uma parcela tem sub-parcelas de recebimento
- Expandir linha para ver os receivables (data prevista, status)

**4. Atualizar types:**
- `BillingPaymentMethod` — adicionar novos tipos
- `PAYMENT_METHOD_LABELS` — adicionar labels
- Novo tipo `BillingPaymentReceivable`

### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Enum + tabela `billing_payment_receivables` + RLS |
| `src/types/billing.ts` | Novos tipos e labels |
| `src/components/financeiro/cobranca/RegisterPaymentModal.tsx` | Reescrever com lógica de parcelamento + sub-parcelas + complemento |
| `src/hooks/useBillingInstallments.ts` | Mutation para editar valor de parcela pendente |
| `src/hooks/useBillingReceivables.ts` | Novo hook: query + mutations para receivables |
| `src/components/financeiro/cobranca/CobrancaInstallments.tsx` | Indicador de receivables + edição inline de valor |
| `src/components/financeiro/cobranca/CobrancaDetailDrawer.tsx` | Seção de receivables + botão redistribuir saldo |

### Fluxo de Uso

1. Operador abre parcela atrasada → clica "Registrar Pagamento"
2. Seleciona "Cartão Parcelado" → informa "3x"
3. Sistema marca parcela como paga e cria 3 receivables com datas de compensação
4. Se pagou valor parcial → opções: redistribuir nas próximas, ou editar manualmente
5. Saldo devedor atualizado automaticamente no drawer

