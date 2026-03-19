

## Plano: Melhorar colunas da tabela de cobranças

### Resumo das mudanças na tabela

Colunas atuais → novas:

| Remover | Manter/Alterar | Adicionar |
|---------|----------------|-----------|
| Quitação (redundante com Status) | Cliente (nome + email) | Valor Pago (novo) |
| | Produto | Parcelas → formato "3/10 pagas" |
| | Status | Dt Fim Prevista (novo) |
| | Valor Total | |
| | Pagamento (forma) | |
| | Responsável | |
| | Início | |

### Ordem final das colunas
1. **Cliente** — nome + email
2. **Produto** — nome do produto
3. **Status** — badge colorido
4. **Valor Total** — valor do contrato
5. **Valor Pago** — soma das parcelas pagas (novo, vem das installments)
6. **Parcelas** — "3/10 pagas" em vez de "10x"
7. **Pagamento** — forma de pagamento
8. **Responsável** — responsável financeiro
9. **Início** — data início
10. **Previsão Final** — `data_fim_prevista` (já existe no modelo, só não é exibida)

### Implementação técnica

**1. `src/hooks/useBillingSubscriptions.ts`**
- Na query de subscriptions, fazer um segundo fetch de `billing_installments` agrupado por `subscription_id` para obter: `valor_pago_total` (soma de `valor_pago` onde status='pago') e `parcelas_pagas` (count onde status='pago')
- Retornar esses dados como um Map e enriquecer cada subscription antes de retornar

**2. `src/types/billing.ts`**
- Adicionar campos opcionais ao tipo `BillingSubscription` (ou criar um tipo estendido): `valor_pago_total?: number` e `parcelas_pagas?: number`

**3. `src/components/financeiro/cobranca/CobrancaTable.tsx`**
- Remover coluna "Quitação"
- Adicionar coluna "Valor Pago" após "Valor Total"
- Alterar "Parcelas" para mostrar `{parcelas_pagas}/{total_parcelas} pagas`
- Adicionar coluna "Previsão Final" usando `data_fim_prevista`
- Destacar visualmente quando valor pago é muito menor que valor total (ex: texto vermelho)

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/types/billing.ts` | Adicionar campos `valor_pago_total` e `parcelas_pagas` ao tipo |
| `src/hooks/useBillingSubscriptions.ts` | Buscar dados de parcelas e enriquecer subscriptions |
| `src/components/financeiro/cobranca/CobrancaTable.tsx` | Atualizar colunas conforme descrito |

