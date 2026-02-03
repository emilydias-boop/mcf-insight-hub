// Types for Consórcio Fechamento (Closers)

export type ConsorcioPayoutStatus = 'DRAFT' | 'APPROVED' | 'LOCKED';

// Pesos fixos para distribuição do variável
export const PESOS_CLOSER_CONSORCIO = {
  comissao_consorcio: 0.72,  // 72% do variável
  comissao_holding: 0.18,    // 18% do variável
  organizacao: 0.10,         // 10% do variável
} as const;

// OTE padrão para closers de consórcio
export const OTE_PADRAO_CONSORCIO = {
  ote_total: 5000,
  fixo_pct: 0.70,      // 70% fixo
  variavel_pct: 0.30,  // 30% variável
};

export interface ConsorcioCloserPayout {
  id: string;
  closer_id: string;
  ano_mes: string; // '2026-02'
  
  // OTE Base
  ote_total: number;
  fixo_valor: number;
  variavel_total: number;
  
  // KPIs do mês
  comissao_consorcio: number;
  comissao_holding: number;
  score_organizacao: number;
  
  // Metas
  meta_comissao_consorcio: number | null;
  meta_comissao_holding: number | null;
  meta_organizacao: number | null;
  
  // Performance %
  pct_comissao_consorcio: number | null;
  pct_comissao_holding: number | null;
  pct_organizacao: number | null;
  
  // Multiplicadores
  mult_comissao_consorcio: number | null;
  mult_comissao_holding: number | null;
  mult_organizacao: number | null;
  
  // Valores finais por métrica
  valor_comissao_consorcio: number | null;
  valor_comissao_holding: number | null;
  valor_organizacao: number | null;
  
  // Totais
  valor_variavel_final: number | null;
  total_conta: number | null;
  
  // Bônus
  bonus_extra: number;
  bonus_autorizado: boolean;
  
  // Status e aprovação
  status: ConsorcioPayoutStatus;
  aprovado_por: string | null;
  aprovado_em: string | null;
  ajustes_json: AjusteConsorcio[];
  
  // Auditoria
  dias_uteis_mes: number;
  nfse_id: string | null;
  created_at: string;
  updated_at: string;
  
  // Join com closer
  closer?: {
    id: string;
    name: string;
    email: string;
    color: string | null;
    is_active: boolean | null;
    employee_id: string | null;
  };
}

export interface AjusteConsorcio {
  descricao: string;
  valor: number;
  tipo: 'bonus' | 'desconto';
  data: string;
  usuario?: string;
}

export interface ConsorcioVendaHolding {
  id: string;
  closer_id: string;
  ano_mes: string;
  descricao: string | null;
  valor_venda: number;
  valor_comissao: number;
  data_venda: string | null;
  created_at: string;
  created_by: string | null;
}

// Form para edição de KPIs
export interface ConsorcioKpiFormData {
  comissao_consorcio: number;
  comissao_holding: number;
  score_organizacao: number;
  meta_comissao_consorcio?: number;
  meta_comissao_holding?: number;
}

// Filtros para listagem
export interface ConsorcioFechamentoFilters {
  anoMes: string;
  closerId?: string;
  status?: ConsorcioPayoutStatus;
}

// Status labels e cores
export const CONSORCIO_STATUS_LABELS: Record<ConsorcioPayoutStatus, { label: string; className: string }> = {
  DRAFT: {
    label: 'Rascunho',
    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  },
  APPROVED: {
    label: 'Aprovado',
    className: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  LOCKED: {
    label: 'Travado',
    className: 'bg-muted text-muted-foreground border-muted',
  },
};

// Multiplicador por % de atingimento (mesmo padrão do SDR)
export function getMultiplier(pct: number): number {
  if (pct < 50) return 0;
  if (pct < 70) return 0.5;
  if (pct < 100) return 0.7;
  if (pct < 150) return 1;
  return 1.5;
}

// Calcula valores do payout
export function calcularPayoutConsorcio(
  variavel_total: number,
  comissao_consorcio: number,
  comissao_holding: number,
  score_organizacao: number,
  meta_comissao_consorcio: number,
  meta_comissao_holding: number,
  meta_organizacao: number = 100
): {
  pct_comissao_consorcio: number;
  pct_comissao_holding: number;
  pct_organizacao: number;
  mult_comissao_consorcio: number;
  mult_comissao_holding: number;
  mult_organizacao: number;
  valor_comissao_consorcio: number;
  valor_comissao_holding: number;
  valor_organizacao: number;
  valor_variavel_final: number;
} {
  // Percentuais de atingimento
  const pct_comissao_consorcio = meta_comissao_consorcio > 0 
    ? (comissao_consorcio / meta_comissao_consorcio) * 100 
    : 100;
  const pct_comissao_holding = meta_comissao_holding > 0 
    ? (comissao_holding / meta_comissao_holding) * 100 
    : 100;
  const pct_organizacao = meta_organizacao > 0 
    ? (score_organizacao / meta_organizacao) * 100 
    : 100;
  
  // Multiplicadores
  const mult_comissao_consorcio = getMultiplier(pct_comissao_consorcio);
  const mult_comissao_holding = getMultiplier(pct_comissao_holding);
  const mult_organizacao = getMultiplier(pct_organizacao);
  
  // Valores finais (peso × mult × variavel_total)
  const valor_comissao_consorcio = variavel_total * PESOS_CLOSER_CONSORCIO.comissao_consorcio * mult_comissao_consorcio;
  const valor_comissao_holding = variavel_total * PESOS_CLOSER_CONSORCIO.comissao_holding * mult_comissao_holding;
  const valor_organizacao = variavel_total * PESOS_CLOSER_CONSORCIO.organizacao * mult_organizacao;
  
  const valor_variavel_final = valor_comissao_consorcio + valor_comissao_holding + valor_organizacao;
  
  return {
    pct_comissao_consorcio,
    pct_comissao_holding,
    pct_organizacao,
    mult_comissao_consorcio,
    mult_comissao_holding,
    mult_organizacao,
    valor_comissao_consorcio,
    valor_comissao_holding,
    valor_organizacao,
    valor_variavel_final,
  };
}
