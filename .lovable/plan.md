

## Corrigir exibição proporcional de Fixo, Metas e Período no detalhe do fechamento

### Problema

No detalhe individual de colaboradores proporcionais (desligados/novos), dois problemas:

1. **Fixo** exibe o valor cheio do plano (ex: R$ 2.800) em vez do proporcional (ex: R$ 2.036 para 16/22 dias)
2. **Metas** no KpiEditForm usam `diasUteisMes` do mês cheio em vez dos dias efetivos trabalhados

### Mudanças

#### 1. `src/pages/fechamento-sdr/Detail.tsx` — Fixo proporcional + metas proporcionais

**Fixo**: Quando `payout.dias_uteis_trabalhados` existe e é menor que `diasUteisMes`, aplicar o ratio no `effectiveFixo` exibido:

```typescript
const isProporcional = payout.dias_uteis_trabalhados != null 
  && payout.dias_uteis_trabalhados < (payout.dias_uteis_mes || diasUteisMes);

const effectiveFixoDisplay = isProporcional
  ? Math.round(effectiveFixo * (payout.dias_uteis_trabalhados / (payout.dias_uteis_mes || diasUteisMes)))
  : effectiveFixo;
```

- Usar `effectiveFixoDisplay` nos cards de "Fixo" e "Total Conta"
- Adicionar badge com período (ex: "16/22 dias") no card de Fixo quando proporcional

**Metas no KpiEditForm**: Passar dias efetivos ao formulário:

```typescript
diasUteisMes={isProporcional ? payout.dias_uteis_trabalhados : (payout.dias_uteis_mes || 19)}
```

Isso faz com que metas como `7/dia × 16 dias = 112` apareçam corretamente em vez de `7/dia × 22 dias = 154`.

### Resultado

- Card "Fixo" mostra valor proporcional com badge de período
- Card "Total Conta" soma fixo proporcional + variável proporcional
- KpiEditForm exibe metas ajustadas ao período efetivo
- Sem mudanças no backend (Edge Function já calcula pro-rata corretamente)

### Arquivos alterados
1. `src/pages/fechamento-sdr/Detail.tsx` — fixo proporcional + dias efetivos no KpiEditForm

