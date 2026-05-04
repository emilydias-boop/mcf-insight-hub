---
name: Funil por Canal — Fotografia da Janela
description: useChannelFunnelReport NÃO usa mais cohort R1+30d. Cada coluna é independente: conta eventos cuja data-âncora cai na janela. Entradas = deals criados na janela.
type: feature
---
`src/hooks/useChannelFunnelReport.ts` (Funil por Canal em Relatórios de Aquisição):

- **Modelo**: fotografia por janela (não-sequencial). Cada coluna é independente.
- **Entradas**: deals com `created_at` na janela, filtrados por origin_id da BU.
- **R1 Agend./Realiz./No-Show**: attendees R1 com `scheduled_at` na janela; desfecho = melhor entre completed > no_show > pending entre attendees do mesmo deal dentro da janela.
- **Contrato Pago**: attendees com `contract_paid_at` na janela.
- **R2 / Aprovados / Reprovados / Próx. Semana**: linhas de `get_carrinho_r2_attendees` na janela, sem gating de cohort.
- **Venda Final / Faturamento**: vendas Hubla de parceria com `sale_date` na janela, dedup por email.

**Por quê:** o cohort R1+30d mascarava as entradas reais do período (forçava entradas = R1 Agendada). Usuário precisa ver o volume bruto de aquisição na janela.

UI em `src/components/relatorios/ChannelFunnelTable.tsx`: título "Fotografia da janela", coluna "Entradas". Excel em `AcquisitionReportPanel.tsx`: cabeçalhos `Entradas` / `Entrada→Venda %`.
