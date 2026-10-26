# Architecture rules

- Revenue summaries classify portfolio payments by period-wide deduplicated gross per existing sale identity before row attribution, so all grouping modes preserve attribution and share the same new-sale boundary.

- Commercial team dashboards share their filter bar and KPI-card renderer; BU-specific data and table columns stay in dedicated page/table adapters to preserve each BU's business rules.- BU Pós Venda is isolated by its single origin id (`POS_VENDA_ORIGIN_ID` in src/lib/posVenda.ts); its stage-deliverable lock is a crm_deals trigger with a WHEN clause on that origin, so other pipelines never run it.
- Pós Venda new-sale ingestion is a hubla_transactions trigger (pos_venda_on_venda → pos_venda_registrar_cliente), so every source (Hubla, Kiwify, MCFPay) is covered without editing webhook handlers; failures are logged to pos_venda_entrada_falhas instead of blocking the sale. A client who already has a card in the BU keeps that card and the sale is only appended to pos_venda_compras (matched by lower(email) or 9-digit phone suffix + first name); a new card is created only when the client has no Pós Venda card.
- Manager distribution for Pós Venda lives only in pos_venda_distribuicao and is applied only inside pos_venda_registrar_cliente, so other BUs' lead distribution is never affected.
- Leaving the "Novos licenciados" stage requires a recent pos_venda_nota_contato activity, enforced by a crm_deals trigger scoped to the Pós Venda origin; client BU movements are logged to crm_cliente_timeline for the future timeline screen.

- Front-end telemetry (errors, page views, page load time) goes only through src/lib/telemetry.ts into app_telemetry, fire-and-forget, so a logging failure never blocks a screen.
- Manual Academy track assignment uses the admin/RH-validated academia_atribuir_trilhas RPC; additional tracks reuse extension records and expose every assigned phase, preserving existing tasks and progress.
- Process materials library (processos/processo_etapas/processo_materiais) is display/edit-only: it never feeds automation_templates or any sending path; /pos-venda/fluxo injects it as window.__MATERIAIS__ and falls back to the HTML's embedded data.
- Flow document dialogs live outside the sandboxed iframe; accept material messages only from its contentWindow and queried material IDs, and keep dialog state independent of flow refetches.
- Script Piloto pilots are derived on read by script_piloto_reunioes (R1 completed, 2–3 unrefunded paid attendees), so they enter and leave automatically without a table or job; AI-generated drafts are never stored and only become official through script_publicar_versao.
- Weekly closer summary is sent only by the resumo-semanal-closers edge function (Monday cron), deduplicated per week+BU in resumo_semanal_closers_envios, so re-runs never double-send.
- CRM timeline, notes, and call history share presentation-only recording and note renderers under timeline/; data fetching and mutations stay in their original hooks so legacy tabs keep their behavior.
