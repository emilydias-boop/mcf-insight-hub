export type PayoutStatus = 'DRAFT' | 'APPROVED' | 'LOCKED';
export type SdrStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Sdr {
  id: string;
  user_id: string | null;
  name: string;
  active: boolean;
  status: SdrStatus;
  criado_por: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface SdrCompPlan {
  id: string;
  sdr_id: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ote_total: number;
  fixo_valor: number;
  variavel_total: number;
  valor_meta_rpg: number;
  valor_docs_reuniao: number;
  valor_tentativas: number;
  valor_organizacao: number;
  ifood_mensal: number;
  ifood_ultrameta: number;
  meta_reunioes_agendadas: number;
  meta_reunioes_realizadas: number;
  meta_tentativas: number;
  meta_organizacao: number;
  status: SdrStatus;
  criado_por: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface SdrMonthKpi {
  id: string;
  sdr_id: string;
  ano_mes: string;
  reunioes_agendadas: number;
  reunioes_realizadas: number;
  tentativas_ligacoes: number;
  score_organizacao: number;
  created_at: string;
  updated_at: string;
}

export interface SdrMonthPayout {
  id: string;
  sdr_id: string;
  ano_mes: string;
  pct_reunioes_agendadas: number | null;
  pct_reunioes_realizadas: number | null;
  pct_tentativas: number | null;
  pct_organizacao: number | null;
  mult_reunioes_agendadas: number | null;
  mult_reunioes_realizadas: number | null;
  mult_tentativas: number | null;
  mult_organizacao: number | null;
  valor_reunioes_agendadas: number | null;
  valor_reunioes_realizadas: number | null;
  valor_tentativas: number | null;
  valor_organizacao: number | null;
  valor_variavel_total: number | null;
  valor_fixo: number | null;
  total_conta: number | null;
  ifood_mensal: number | null;
  ifood_ultrameta: number | null;
  total_ifood: number | null;
  status: PayoutStatus;
  aprovado_por: string | null;
  aprovado_em: string | null;
  ajustes_json: PayoutAdjustment[];
  created_at: string;
  updated_at: string;
}

export interface PayoutAdjustment {
  tipo: string;
  campo: string;
  valor: number;
  motivo: string;
  created_at: string;
  created_by: string;
}

export interface SdrPayoutAuditLog {
  id: string;
  payout_id: string;
  user_id: string | null;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo: string | null;
  created_at: string;
}

export interface SdrPayoutWithDetails extends SdrMonthPayout {
  sdr: Sdr;
  comp_plan?: SdrCompPlan;
  kpi?: SdrMonthKpi;
}

// Faixas de multiplicador
export const MULTIPLIER_RANGES = [
  { min: 0, max: 70, mult: 0, label: '0-70%' },
  { min: 71, max: 85, mult: 0.5, label: '71-85%' },
  { min: 86, max: 99, mult: 0.7, label: '86-99%' },
  { min: 100, max: 119, mult: 1, label: '100-119%' },
  { min: 120, max: Infinity, mult: 1.5, label: '≥120%' },
] as const;

export const getMultiplier = (pct: number): number => {
  if (pct < 71) return 0;
  if (pct <= 85) return 0.5;
  if (pct <= 99) return 0.7;
  if (pct <= 119) return 1;
  return 1.5;
};

export const getMultiplierRange = (pct: number): string => {
  const range = MULTIPLIER_RANGES.find(r => pct >= r.min && pct <= r.max);
  return range?.label || '';
};
