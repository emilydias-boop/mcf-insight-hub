---
name: SDR Meta Percentuais por Comp Plan
description: Percentual de Reuniões Realizadas (default 70%) e teto de No-Show (default 30%) saem do sdr_comp_plan; UI e edge function derivam de meta_reunioes_realizadas/agendadas e meta_no_show_pct.
type: feature
---
- `getRealizadasPct(compPlan)` em `src/lib/sdrMetaPercentuais.ts` deriva `meta_reunioes_realizadas / meta_reunioes_agendadas` (fallback 0.7).
- `getNoShowMaxPct(compPlan)` usa `meta_no_show_pct` (fallback 30).
- `calculateNoShowPerformance(noShows, agendadas, maxPct)` agora aceita teto configurável (default 30) tanto no `src/types/sdr-fechamento.ts` quanto na edge function `recalculate-sdr-payout`.
- Maio/2026 BU Incorporador (SDRs, `squad='incorporador'`, `role_type='sdr'`): meta_no_show_pct=40 e meta_reunioes_realizadas=ROUND(agendadas*0.6) — ajuste único do mês.
- Para mudar percentuais em outro mês/BU, atualize `sdr_comp_plan` daquele período; o código não tem ifs por data.
- **UI:** os percentuais podem ser editados em **Configurações de Fechamento > Planos OTE > Editar Plano Individual**: Teto de No-Show (%) e Reuniões Realizadas (%). Intermediações de Contrato (%) é configurado por cargo/squad na aba **Métricas Ativas** e exibido com link no mesmo dialog.