# Architecture rules

- Commercial team dashboards share their filter bar and KPI-card renderer; BU-specific data and table columns stay in dedicated page/table adapters to preserve each BU's business rules.- BU Pós Venda is isolated by its single origin id (`POS_VENDA_ORIGIN_ID` in src/lib/posVenda.ts); its stage-deliverable lock is a crm_deals trigger with a WHEN clause on that origin, so other pipelines never run it.
