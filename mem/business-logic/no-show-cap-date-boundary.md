---
name: No-Show Cap Date Boundary
description: Em get_sdr_metrics_from_agenda, no-show cap=1 por lead até 2026-04-30 e cap=2 a partir de 2026-05-01.
type: feature
---
KPI **No-Show** (`get_sdr_metrics_from_agenda` / `noshow_per_lead`):
- `meeting_day < 2026-05-01` → cap **1** no-show por lead.
- `meeting_day >= 2026-05-01` → cap **2** no-shows por lead.
