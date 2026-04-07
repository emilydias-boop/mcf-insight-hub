

# Historico de Acoes de Cobranca + Marcar como Pago

## Problema
Quando o operador marca "Boleto Enviado", o alerta some e nao ha como acompanhar se o lead pagou ou nao. Falta um historico das acoes ja registradas com possibilidade de atualizar o status (ex: marcar como pago).

## Mudancas

### 1. Hook `useCobrancaHistory.ts` (novo)
- Query na tabela `cobranca_acoes` com join em `consortium_installments` (card data) e `billing_installments` (subscription data)
- Filtro por tipo (consorcio/billing) e por periodo
- Retorna lista com: nome do lead, grupo/cota, parcela, valor, vencimento, tipo_acao, data da acao, observacao
- Ordenado por `created_at` desc

### 2. Componente `CobrancaHistoryPanel.tsx` (novo)
Painel colapsavel abaixo do `CobrancaAlertPanel`, mostrando acoes recentes:
- Tabs ou filtro: "Boleto Enviado" / "Lead Respondeu" / "Sem Retorno" / "Todos"
- Cada item mostra: nome, grupo/cota, parcela, valor, data vencimento, quando foi marcado, por quem
- Botao "Pago" em cada linha para registrar `pago_confirmado` (usa `useRegistrarAcaoCobranca` existente)
- Botao "Sem Retorno" para quem esta como "Boleto Enviado" mas nao respondeu
- Badge colorido por status da acao
- Limite de 50 itens recentes, com opcao de ver mais

### 3. Integracao em `Pagamentos.tsx`
- Renderizar `CobrancaHistoryPanel` abaixo do `CobrancaAlertPanel`
- Passar `type="consorcio"`

### 4. Integracao em `FinanceiroCobrancas.tsx`
- Renderizar `CobrancaHistoryPanel` com `type="billing"`

### Arquivos
| Arquivo | Acao |
|---------|------|
| `src/hooks/useCobrancaHistory.ts` | Novo hook de historico |
| `src/components/shared/CobrancaHistoryPanel.tsx` | Novo componente de historico |
| `src/pages/bu-consorcio/Pagamentos.tsx` | Integrar painel |
| `src/components/financeiro/cobranca/FinanceiroCobrancas.tsx` | Integrar painel |

### Fluxo
```text
1. Operador marca "Boleto Enviado" no alerta → alerta some
2. Parcela aparece no Historico com status "Boleto Enviado"
3. Lead pagou? → Clica "Pago" → registra pago_confirmado
4. Lead nao respondeu? → Clica "Sem Retorno" → fica registrado
5. Historico mostra timeline completa de cada parcela
```

