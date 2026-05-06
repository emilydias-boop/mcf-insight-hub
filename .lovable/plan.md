
# Mostrar "vindos de semanas anteriores" em cada card do Painel R2 Carrinho

## Contexto

Validei na base via RPC `get_carrinho_r2_attendees` que os leads desta safra com **contrato pago em semanas anteriores** (antes do corte de abertura) estão **corretamente distribuídos** entre os buckets operacionais:

```text
Realizadas (completed)       → contam em "R2 Realizadas"
No-Show                      → contam em "No-Show R2"
Reembolso/Desistente         → contam em "Fora do Carrinho"
Agendadas ainda pendentes    → contam em "R2 Agendadas"
```

A contagem está certa. Falta **mostrar isso explicitamente no painel** para qualquer pessoa que olhe entender de onde vêm esses leads, sem precisar abrir o card "Semanas Anteriores".

## O que vai mudar

### 1. Quebrar o KPI "Semanas Anteriores" em 4 sub-contadores

No hook `useR2CarrinhoKPIs.ts`, criar dentro do mesmo loop (mesma condição `opOk + contractTs < prevCutoffTs`) os seguintes contadores:

```text
semanasAnteriores              (total - 11)
  ├─ semanasAnterioresRealizadas
  ├─ semanasAnterioresAgendadas
  ├─ semanasAnterioresNoShow
  └─ semanasAnterioresForaDoCarrinho   (reembolso/desistente)
```

A regra para cada sub-bucket é exatamente a mesma já usada nos KPIs principais (mesmas funções `isRealizada`, `isAgendada` + `SCHEDULED_STATES`, no_show, `isForaDoCarrinho`).

### 2. Exibir badge "↩ X de semanas anteriores" em cada card

Em cada um dos 4 cards do painel R2 Carrinho, adicionar uma linha pequena abaixo do número principal:

```text
┌─────────────────────────────┐
│ R2 Realizadas               │
│ 10                          │
│ ↩ 8 vieram de sem. anterior │
└─────────────────────────────┘
```

Aplicar nos cards:
- **R2 Realizadas** → mostra `semanasAnterioresRealizadas`
- **R2 Agendadas** → mostra `semanasAnterioresAgendadas`
- **No-Show R2** → mostra `semanasAnterioresNoShow`
- **Fora do Carrinho** → mostra `semanasAnterioresForaDoCarrinho`

Quando o sub-contador for 0, ocultar a linha (não polui o card).

### 3. Manter o card "Semanas Anteriores"

Continua existindo como totalizador (`11`), agora com tooltip explicando:

> "Total de leads desta safra com contrato pago em semanas anteriores. Já estão somados nos cards de R2 Realizadas, R2 Agendadas, No-Show e Fora do Carrinho — veja o detalhe '↩ X' em cada um."

## Arquivos a alterar

- **`src/hooks/useR2CarrinhoKPIs.ts`** — adicionar 4 campos ao `R2CarrinhoKPIs` e calcular no mesmo loop existente.
- **Componente do painel R2 Carrinho** (provavelmente `src/pages/crm/R2Carrinho.tsx` ou um sub-componente de KPI cards) — renderizar a linha "↩ X de semanas anteriores" condicional em cada card e atualizar o tooltip do card "Semanas Anteriores".

## O que NÃO vai mudar

- Nenhuma regra de contagem dos KPIs principais.
- Nenhuma janela operacional, corte ou definição de safra.
- A RPC `get_carrinho_r2_attendees` continua igual.
- Os totais dos cards continuam idênticos aos atuais.

## Resultado esperado

Você abre `/crm/r2-carrinho` e vê em cada card o número total + a parcela que veio de semanas anteriores, sem precisar fazer cruzamento mental. O card "Semanas Anteriores: 11" passa a ser apenas a soma de conferência (`8 + 2 + 1 + 0 = 11`, por exemplo).
