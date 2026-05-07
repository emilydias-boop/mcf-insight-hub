---
name: SDR Meta Diária Monthly Isolation
description: Meta de agendadas no payout vem de sdr_comp_plan.meta_reunioes_agendadas (por mês), não de sdr.meta_diaria global.
type: feature
---
recalculate-sdr-payout deriva metaDiariaDoMes = compPlan.meta_reunioes_agendadas / compPlan.dias_uteis. Fallback para sdr.meta_diaria só quando compPlan não tem a meta congelada.

PlansOteTab só atualiza sdr.meta_diaria global se o mês editado for >= mês corrente. Editar plano de mês passado NÃO sobrescreve mais a meta global, evitando contaminar outros meses.
