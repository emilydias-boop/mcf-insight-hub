import type { FunnelMetricKey } from '@/hooks/useChannelFunnelReport';

export interface FunnelMetricConfig {
  label: string;
  rule: string;       // texto da regra (mesmo do tooltip)
  isMonetary?: boolean;
  isVendaShape?: boolean; // se true, modal mostra colunas de produto/valor
}

export const FUNNEL_METRICS_CONFIG: Record<FunnelMetricKey, FunnelMetricConfig> = {
  entradas: {
    label: 'Entradas',
    rule: 'Deals criados no período (crm_deals.created_at) com origem da BU. Cada deal conta uma vez.',
  },
  r1Agendada: {
    label: 'R1 Agendada',
    rule: 'Deals únicos com R1 cujo scheduled_at cai na janela (status NÃO em cancelled/rescheduled). Cada deal conta uma vez.',
  },
  r1Realizada: {
    label: 'R1 Realizada',
    rule: 'Deals únicos cuja R1 ficou com status completed e scheduled_at na janela.',
  },
  noShow: {
    label: 'No-Show',
    rule: 'Deals únicos cuja R1 ficou com status no_show e scheduled_at na janela.',
  },
  contratoPago: {
    label: 'Contrato Pago',
    rule: 'Deals únicos cujo contract_paid_at (no attendee R1) cai dentro da janela.',
  },
  r2Agendada: {
    label: 'R2 Agendada',
    rule: 'Attendees R2 com scheduled_at na janela exata. Deduplicado por deal.',
  },
  r2Realizada: {
    label: 'R2 Realizada',
    rule: 'R2 com status completed/realizada na janela exata. Deduplicado por deal.',
  },
  aprovados: {
    label: 'Aprovados',
    rule: 'Attendees R2 com r2_status_name contendo "aprovado" na janela.',
  },
  reprovados: {
    label: 'Reprovados',
    rule: 'Attendees R2 cujo r2_status_name indica saída (reembolso, desistente, reprovado, cancelado).',
  },
  proximaSemana: {
    label: 'Próxima Semana',
    rule: 'Attendees R2 marcados como "Próxima semana".',
  },
  vendaFinal: {
    label: 'Venda Final',
    rule: 'Vendas únicas (por email) de produtos de parceria (A001/A005/A009 completo) com sale_date na janela. Inclui upsells e recompras.',
    isVendaShape: true,
  },
  faturamentoBruto: {
    label: 'Faturamento Bruto',
    rule: 'Soma de reference_price (preço de tabela) das vendas únicas no período.',
    isMonetary: true,
    isVendaShape: true,
  },
  faturamentoLiquido: {
    label: 'Faturamento Líquido',
    rule: 'Soma do valor recebido no Hubla (product_price) das vendas únicas no período.',
    isMonetary: true,
    isVendaShape: true,
  },
};