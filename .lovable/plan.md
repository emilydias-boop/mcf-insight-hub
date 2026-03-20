

## Plano: Melhorar Drawer de Detalhe de Cobrança

### Problema
O drawer mostra apenas 4 KPIs genéricos (Total Contrato, Total Pago, Saldo Devedor, Parcelas). Faltam informações essenciais: **valor bruto vs líquido**, **forma de pagamento**, **responsável pela venda**. Na tabela, o "Valor" mostrado é `valor_original` mas não fica claro se é bruto ou líquido. A coluna "Pago" mostra `valor_pago` mas sem contexto de líquido.

### O que já existe no banco
- `billing_subscriptions`: `forma_pagamento`, `responsavel_financeiro`, `valor_total_contrato`, `valor_entrada`
- `billing_installments`: `valor_original` (bruto), `valor_liquido`, `valor_pago`, `forma_pagamento`

### Alterações

| Arquivo | O que muda |
|---------|------------|
| `src/components/financeiro/cobranca/CobrancaDetailDrawer.tsx` | Reformular header KPIs e adicionar info contextual |
| `src/components/financeiro/cobranca/CobrancaInstallments.tsx` | Adicionar colunas "Líquido" e "Forma Pgto" na tabela |

### Header KPIs — de 4 para 6 cards

1. **Valor Bruto** — `valor_total_contrato` (soma dos `valor_original` das parcelas)
2. **Valor Líquido** — soma dos `valor_liquido` de todas as parcelas (o que realmente entra)
3. **Total Pago** — soma dos `valor_pago` das parcelas pagas
4. **Saldo Devedor** — valor líquido total - total pago
5. **Parcelas** — `pagas / total`
6. **Forma Pagamento** — `PAYMENT_METHOD_LABELS[subscription.forma_pagamento]` (ex: "Cartão Parcelado", "PIX Parcelado", "Outro")

### Info contextual abaixo dos KPIs
- **Responsável**: `subscription.responsavel_financeiro || 'Não informado'`
- **Forma de pagamento** destacada com badge colorido — se `outro` ou `null`, mostrar alerta amarelo "Forma de pagamento não identificada — verificar se é cobrável"

### Tabela de Parcelas — colunas adicionais

Colunas atuais: `#, Vencimento, Valor, Pago, Status, Data Pgto, Ações`

Novas colunas:
- Renomear "Valor" → **"Bruto"** (`valor_original`)
- Adicionar **"Líquido"** (`valor_liquido`) — se zero, mostrar em cinza claro
- Adicionar **"Forma Pgto"** — `inst.forma_pagamento` com label, se null mostrar "-"
- "Pago" continua mostrando `valor_pago`

### Cálculos no drawer

```typescript
const totalBruto = installments.reduce((s, i) => s + (i.valor_original || 0), 0);
const totalLiquido = installments.reduce((s, i) => s + (i.valor_liquido || 0), 0);
const totalPago = installments.filter(i => i.status === 'pago').reduce((s, i) => s + (i.valor_pago || 0), 0);
const saldoDevedor = totalLiquido - totalPago;
```

Isso resolve o problema do usuário: se `totalLiquido` for muito diferente de `totalBruto`, fica visível. Se `forma_pagamento` for "outro", o operador sabe que precisa investigar antes de cobrar.

