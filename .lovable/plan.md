## Objetivo

Aplicar, **somente em maio/2026** e **somente para SDRs da BU Incorporador**, as novas metas:
- Reuniões Realizadas: **60%** das agendadas (era 70%)
- No-Show: **máx. 40%** (era 30%) — usado também no cálculo inverso do payout

Mantém o padrão 70%/30% para os demais meses e demais BUs.

## Estratégia

Em vez de espalhar exceções "maio + incorporador" pelo código, vou usar os campos que já existem em `sdr_comp_plan`:
- `meta_reunioes_realizadas` (já é gravado por SDR/mês)
- `meta_no_show_pct` (já existe, hoje fixo em 30)

Hoje a UI e a edge function ignoram esses campos e usam 0.7 / 30 hardcoded. A mudança torna esses campos a fonte da verdade (com fallback nos valores atuais para meses/SDRs antigos).

## Passos

### 1. Migration de dados (maio/2026, BU Incorporador)
Para cada SDR cujo `sdr.squad = 'incorporador'` com `sdr_comp_plan.vigencia_inicio = '2026-05-01'`:
- `meta_no_show_pct = 40`
- `meta_reunioes_realizadas = ROUND(meta_reunioes_agendadas * 0.6)`

Não altera planos APPROVED já travados de outros meses.

### 2. Edge function `recalculate-sdr-payout`
- `calculateNoShowPerformance(noShows, agendadas, maxPct)` passa a receber o teto (default 30); usa `compPlan.meta_no_show_pct` quando > 0.
- `metaRealizadasAjustada`: se `compPlan.meta_reunioes_realizadas > 0`, usa um percentual derivado (`meta_realizadas / meta_agendadas`) aplicado às agendadas REAIS do mês; senão mantém o 0.7 atual. Mantém também o override `configOverrides.meta_realizadas_ajustada` (prioritário).

### 3. UI — `KpiEditForm.tsx`
- Substitui `0.7` por `compPlan.meta_reunioes_realizadas / compPlan.meta_reunioes_agendadas` (fallback 0.7).
- Substitui "Max: 30%" por `compPlan.meta_no_show_pct` (fallback 30).
- Atualiza o texto "70% de X agendadas" para refletir o percentual real (ex.: "60% de 221 agendadas").

### 4. UI — `DynamicKpiField.tsx`, `DynamicIndicatorCard.tsx`, `CloserIndicators.tsx`, `PlansOteTab.tsx`
Mesma troca: percentuais derivados do comp plan, fallback nos valores atuais. Em PlansOteTab a meta de realizadas continua sendo recalculada ao salvar (vai usar o mesmo helper).

### 5. Helper compartilhado
Criar `src/lib/sdrMetaPercentuais.ts` com:
```ts
getRealizadasPct(compPlan) // default 0.7
getNoShowMaxPct(compPlan)  // default 30
```
Usado pelos componentes em (3) e (4) para evitar repetição.

## Detalhes técnicos

- A regra **não** depende de hardcode "maio + incorporador" no código — fica só nos dados (comp plans). Se amanhã o reajuste virar permanente ou se outra BU mudar, basta atualizar o comp plan do mês.
- Planos APPROVED/LOCKED não são alterados; apenas os PENDING de maio/2026 incorporador (confirmei: hoje os incorporador desse mês estão em PENDING).
- Closers da BU Incorporador também usam o mesmo comp plan? Sim, mas para Closer os campos `meta_reunioes_realizadas` e `meta_no_show_pct` afetariam o cálculo do Closer também. Como você disse "todos da BU Incorporador", vou aplicar a todos os SDRs do squad incorporador (não Closers). **Confirme** se Closers Incorporador também devem ir para 60%/40%.

## Fora de escopo

- Não muda o cap de no-show por lead (1 ou 2) — isso é outro KPI (`get_sdr_metrics_from_agenda`).
- Não muda metas de junho em diante.