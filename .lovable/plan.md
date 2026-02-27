

## Problema Identificado

Existem **duas fontes diferentes** de contagem de outsides:

1. **`useR1CloserMetrics`** → retorna 23 outsides (correto, usado na tabela de Closers)
2. **`useSdrOutsideMetrics`** → retorna 0 outsides (usado nos KPI cards e enrichedKPIs)

A divergência faz com que:
- KPI "Contratos" mostre `185 + 0 = 185` com tooltip "Outside: 0"
- A tabela de Closers mostre Outside: 23 e Total: 206
- O painel "Metas da Equipe" use `totalContratos` sem outsides

## Solução

Derivar o total de outsides a partir dos `closerMetrics` (que já funciona corretamente) e usá-lo como fonte de verdade para KPIs e Goals Panel.

### Alterações

**`src/pages/crm/ReunioesEquipe.tsx`**:
- No `enrichedKPIs`, calcular `totalOutside` a partir de `closerMetrics` (soma de `outside` de cada closer) como fallback quando `outsideData` retorna 0
- Nos `dayValues`, `weekValues` e `monthValues` do GoalsPanel, somar outsides ao campo `contrato`

**Lógica**:
```
const outsideFromClosers = closerMetrics?.reduce((sum, c) => sum + c.outside, 0) || 0;

enrichedKPIs.totalOutside = outsideData?.totalOutside || outsideFromClosers;
```

Para o GoalsPanel, o `monthValues.contrato` precisa incluir outsides para bater com o KPI. Como o GoalsPanel usa hooks separados (dia/semana/mês), a correção mais limpa é adicionar o outside dos closerMetrics ao `monthValues.contrato` (já que closerMetrics é filtrado pelo período selecionado).

### Detalhes técnicos

O `useSdrOutsideMetrics` provavelmente retorna 0 porque usa lógica de detecção diferente (busca por `product_category IN ('contrato','incorporador')` + `ilike '%contrato%'`), enquanto `useR1CloserMetrics` compara `contract_paid_at < scheduled_at`. As lógicas divergem. A correção unifica usando `closerMetrics` como fonte única.

