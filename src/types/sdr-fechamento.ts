export type PayoutStatus = 'DRAFT' | 'APPROVED' | 'LOCKED';
export type SdrStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SdrLevel {
  level: number;
  fixo_valor: number;
  description: string | null;
}

export interface Sdr {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  active: boolean;
  nivel: number;
  meta_diaria: number;
  observacao: string | null;
  status: SdrStatus;
  criado_por: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
  updated_at: string;
  // Campos adicionais para fechamento adaptativo
  role_type?: 'sdr' | 'closer';
  squad?: string;
  closer_id?: string;
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
  dias_uteis: number;
  meta_no_show_pct: number;
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
  no_shows: number;
  intermediacoes_contrato: number;
  taxa_no_show: number | null;
  // Novas colunas para contagem automática de ligações
  ligacoes_contato: number;
  tentativas_auto: number;
  ligacoes_manual_override: boolean;
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
  pct_no_show: number | null;
  mult_reunioes_agendadas: number | null;
  mult_reunioes_realizadas: number | null;
  mult_tentativas: number | null;
  mult_organizacao: number | null;
  mult_no_show: number | null;
  valor_reunioes_agendadas: number | null;
  valor_reunioes_realizadas: number | null;
  valor_tentativas: number | null;
  valor_organizacao: number | null;
  valor_no_show: number | null;
  valor_variavel_total: number | null;
  valor_fixo: number | null;
  total_conta: number | null;
  ifood_mensal: number | null;
  ifood_ultrameta: number | null;
  ifood_ultrameta_autorizado: boolean;
  ifood_ultrameta_autorizado_por: string | null;
  ifood_ultrameta_autorizado_em: string | null;
  total_ifood: number | null;
  nfse_id: string | null;
  // Metas ajustadas proporcionalmente aos dias úteis do mês
  meta_agendadas_ajustada: number | null;
  meta_realizadas_ajustada: number | null;
  meta_tentativas_ajustada: number | null;
  dias_uteis_mes: number | null;
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

export interface SdrIntermediacao {
  id: string;
  sdr_id: string;
  ano_mes: string;
  hubla_transaction_id: string | null;
  produto_nome: string | null;
  valor_venda: number | null;
  observacao: string | null;
  created_at: string;
  created_by: string | null;
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

// Cálculo inverso do No-Show
// Se taxa_no_show <= 30% → performance = 100% + bônus proporcional até 150%
// Se taxa_no_show > 30% → performance decresce
export const calculateNoShowPerformance = (noShows: number, agendadas: number): number => {
  if (agendadas <= 0) return 100;
  
  const taxaNoShow = (noShows / agendadas) * 100;
  
  if (taxaNoShow <= 30) {
    // Quanto menor a taxa, melhor (bônus até 150%)
    return Math.min(150, 100 + ((30 - taxaNoShow) / 30) * 50);
  } else {
    // Acima de 30%, penalidade
    return Math.max(0, 100 - ((taxaNoShow - 30) / 30) * 100);
  }
};

// === Novos tipos para Fechamento da Equipe ===

export interface FechamentoMetricaMes {
  id: string;
  ano_mes: string;
  cargo_catalogo_id: string | null;
  squad: string | null;
  nome_metrica: string;
  label_exibicao: string;
  peso_percentual: number;
  meta_valor: number | null;
  fonte_dados: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Lista de métricas disponíveis para configuração
export const METRICAS_DISPONIVEIS = [
  { nome: 'agendamentos', label: 'Agendamentos R1', fonte: 'agenda' },
  { nome: 'realizadas', label: 'R1 Realizadas', fonte: 'agenda' },
  { nome: 'contratos', label: 'Contratos Pagos', fonte: 'hubla' },
  { nome: 'tentativas', label: 'Tentativas de Ligação', fonte: 'twilio' },
  { nome: 'organizacao', label: 'Organização', fonte: 'manual' },
  { nome: 'no_show', label: 'No-Show (inverso)', fonte: 'agenda' },
  { nome: 'outside_sales', label: 'Outside Sales', fonte: 'manual' },
  { nome: 'r2_agendadas', label: 'R2 Agendadas', fonte: 'agenda' },
] as const;

export type MetricaNome = typeof METRICAS_DISPONIVEIS[number]['nome'];
