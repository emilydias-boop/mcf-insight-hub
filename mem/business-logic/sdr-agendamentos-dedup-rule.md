---
name: SDR Agendamentos Dedup Rule
description: KPI Agendamentos em get_sdr_metrics_from_agenda deduplica por (sdr, deal_id, meeting_day) para evitar inflar com duplicatas/reagendamentos no mesmo dia.
type: feature
---
KPI **Agendamentos** (função `get_sdr_metrics_from_agenda`):
- Deduplica por **(sdr_email, deal_id, meeting_day)** antes de contar — múltiplas linhas do mesmo lead no mesmo dia (ex.: agendamento errado não-cancelado + reagendamento) contam como **1**.
- Cap de **2 agendamentos por deal** no mês (igual R1 Agendada).
- Janela: `first_booked_at` (mínimo dos `booked_at`/`created_at` da dedup) BETWEEN start_d AND effective_end.
- Continua excluindo `status='cancelled'`, parceiros e fora do squad.

**Por quê:** antes usava `COUNT(*)` cru; se o SDR esquecia de cancelar uma R1 errada antes de reagendar, ambas inflavam o número. Identificado em 30/04/2026 (5 leads em abril estavam mascarando os totais).
