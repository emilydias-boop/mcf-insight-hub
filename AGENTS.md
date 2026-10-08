# Architecture rules

- Commercial team dashboards share their filter bar and KPI-card renderer; BU-specific data and table columns stay in dedicated page/table adapters to preserve each BU's business rules.- BU Pós Venda is isolated by its single origin id (`POS_VENDA_ORIGIN_ID` in src/lib/posVenda.ts); its stage-deliverable lock is a crm_deals trigger with a WHEN clause on that origin, so other pipelines never run it.
- Pós Venda new-sale ingestion is a hubla_transactions trigger (pos_venda_on_venda → pos_venda_registrar_cliente), so every source (Hubla, Kiwify, MCFPay) is covered without editing webhook handlers; failures are logged to pos_venda_entrada_falhas instead of blocking the sale.
- Manager distribution for Pós Venda lives only in pos_venda_distribuicao and is applied only inside pos_venda_registrar_cliente, so other BUs' lead distribution is never affected.
- Leaving the "Novos licenciados" stage requires a recent pos_venda_nota_contato activity, enforced by a crm_deals trigger scoped to the Pós Venda origin; client BU movements are logged to crm_cliente_timeline for the future timeline screen.
