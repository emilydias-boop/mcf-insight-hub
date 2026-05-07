## Causa raiz

Quando você edita o plano OTE de **maio** em `PlansOteTab`, o código (linhas 255-259 de `src/components/fechamento/PlansOteTab.tsx`) faz duas coisas:

1. Cria/atualiza o registro de `sdr_comp_plan` com `vigencia_inicio = 2026-05-01` (correto, isolado por mês).
2. **Atualiza `sdr.meta_diaria` globalmente** — sem dimensão de mês:

```ts
await supabase.from('sdr')
  .update({ meta_diaria: values.meta_diaria })
  .eq('id', sdrId);
```

A edge function `recalculate-sdr-payout` (linha 1477) calcula a meta de agendadas usando esse `sdr.meta_diaria` global:

```
meta_agendadas_ajustada = sdr.meta_diaria × dias_uteis_mes
```

Como `sdr.meta_diaria` é um único campo na tabela `sdr` (sem histórico), assim que você salva o plano de maio com meta nova, **abril passa a usar essa mesma meta** quando o fechamento de abril é recalculado/aberto.

A coluna `sdr_comp_plan.meta_reunioes_agendadas` JÁ existe e é salva por mês (= `meta_diaria × 19`), então a informação correta de meta por mês já está persistida — só não está sendo lida na hora do cálculo.

## Correção

### 1. `supabase/functions/recalculate-sdr-payout/index.ts`

No cálculo do payout (função `calculatePayoutValues`, ~linha 138), derivar `meta_diaria` do próprio `compPlan` daquele mês em vez do `sdr.meta_diaria` global:

```ts
const metaDiariaDoMes = compPlan.meta_reunioes_agendadas && compPlan.dias_uteis
  ? compPlan.meta_reunioes_agendadas / compPlan.dias_uteis
  : sdrMetaDiaria; // fallback para planos antigos sem o campo
const metaAgendadasAjustada = Math.round(metaDiariaDoMes * diasUteisReal);
```

Assim cada mês usa a meta congelada no `sdr_comp_plan` daquele período.

### 2. `src/components/fechamento/PlansOteTab.tsx` (saveCompPlan, linhas 255-259)

Só atualizar `sdr.meta_diaria` global se o mês selecionado for o **mês corrente ou futuro** (para não sobrescrever quando o usuário está editando histórico). Tecnicamente:

```ts
const [year, month] = anoMes.split('-').map(Number);
const today = new Date();
const isCurrentOrFuture = year > today.getFullYear()
  || (year === today.getFullYear() && month >= today.getMonth() + 1);

if (isCurrentOrFuture) {
  await supabase.from('sdr').update({ meta_diaria: values.meta_diaria }).eq('id', sdrId);
}
```

A meta do mês continua sempre persistida em `sdr_comp_plan.meta_reunioes_agendadas` (já acontece), que é a fonte de verdade após a correção #1.

### 3. Backfill (uma vez)

Recalcular o payout de **abril/2026** dos SDRs cujo plano de maio foi editado nos últimos dias, usando agora o `compPlan` correto de abril. Isso restaura os percentuais de abril.

## Validação

- Editar plano de maio do SDR X com meta diária 12 → `sdr.meta_diaria` vira 12 (apenas se maio é mês corrente/futuro), `sdr_comp_plan` de maio salva `meta_reunioes_agendadas = 12 × 19`.
- Reabrir fechamento de abril do SDR X → meta de agendadas de abril é lida do `sdr_comp_plan` de abril (ex.: 10 × 19 = 190), não muda.
- Reabrir maio → meta = 12 × dias_uteis de maio.

## Escopo do que NÃO muda

- Nenhuma alteração em UI da Agenda R2.
- `sdr.meta_diaria` continua existindo (usado em outras telas como `SdrConfigTab`, `InvestigationReportPanel`) — apenas deixa de ser usado pela edge function como única fonte de verdade.