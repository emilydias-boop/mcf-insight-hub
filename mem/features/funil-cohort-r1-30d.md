---
name: Funil por Canal Cohort R1+30d
description: useChannelFunnelReport agora é cohort sequencial — base = deals com R1 Agendada na janela; demais colunas contam eventos até 30d após a R1 âncora.
type: feature
---
`src/hooks/useChannelFunnelReport.ts` (Funil por Canal em Relatórios de Aquisição):

- **Cohort base**: deals únicos com R1 (`meeting_slot_attendees` + `meeting_slots.meeting_type='r1'`) cujo `scheduled_at` cai na janela do filtro, origin na BU, sem cancelled/rescheduled. Âncora = R1 mais antiga elegível.
- **Follow-up**: 30 dias corridos a partir do `anchor` (constante `COHORT_FOLLOWUP_DAYS = 30`).
- **R1 Realizada / No-Show**: melhor desfecho (`completed > no_show > pending`) entre attendees R1 do deal cujo `scheduled_at` esteja dentro do follow-up.
- **Contrato Pago**: deal do cohort com `contract_paid_at` (qualquer attendee R1) dentro do follow-up.
- **R2 / Aprovados / Reprovados / Próx. Semana**: linhas de `get_carrinho_r2_attendees` filtradas para `deal_id ∈ cohort`.
- **Venda Final / Faturamento**: vendas Hubla de parceria cujo `customer_email` pertence a um deal do cohort E `sale_date` dentro do follow-up.
- **Entradas (campo `entradas`)**: mantido por compatibilidade com o tipo/Excel — agora vale igual a `r1Agendada` (tamanho do cohort). UI mostra como "Cohort (R1)".

**Por quê:** versão antiga era fotografia independente por coluna — não permitia ler conversão real ("dos X que marcaram R1, Y fecharam contrato"). Cohort R1+30d entrega funil sequencial verdadeiro com janela de maturação fixa para comparações justas entre meses.

Tooltips e títulos atualizados em `src/components/relatorios/ChannelFunnelTable.tsx`. Export Excel em `AcquisitionReportPanel.tsx` renomeado: `Entradas → Cohort (R1)`, `Entrada→Venda % → Cohort→Venda %`.