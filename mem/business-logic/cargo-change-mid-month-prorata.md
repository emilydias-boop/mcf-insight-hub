---
name: Cargo Change Mid-Month Pro-rata
description: Quando colaborador muda de cargo no meio do mês, o fechamento divide o valor fixo proporcionalmente entre os dois cargos via employee_cargo_history.
type: feature
---
Regra: mudança de cargo (cargo_catalogo_id) em employees é registrada automaticamente em employee_cargo_history (trigger). O edge function recalculate-sdr-payout busca todos os segmentos que interceptam o mês e:
- Calcula dias úteis de cada segmento dentro do período efetivo (admissão→demissão ∩ mês)
- Fixo do mês = soma de (fixo_cargo × dias_segmento / dias_uteis_mes_total) por segmento
- Persiste a quebra em sdr_month_payout.cargo_segments (jsonb) para auditoria
- UI: PayoutTableRow mostra badge "🔄 cargo" quando cargo_segments.length > 1

Backfill executado para Cristiane Gomes (07ca8150...): Closer Inside N1 até 13/04/2026, Gerente de Contas Inside a partir de 14/04/2026.

Casos de pró-rata por admissão/demissão (Andre, Nicola, Mateus, William) continuam intactos — segmentos só ativam quando há > 1 cargo no período.
