import { BusinessUnit } from '@/hooks/useMyBU';

export type PremiacaoStatus = 'rascunho' | 'ativa' | 'encerrada' | 'cancelada';
export type TipoCompeticao = 'individual' | 'equipe' | 'ambos';

export type MetricaRanking = 
  | 'agendamentos'
  | 'realizadas'
  | 'contratos'
  | 'tentativas'
  | 'no_show_inverso'
  | 'taxa_conversao'
  | 'ote_pct';

export interface MetricaConfig {
  inverso?: boolean;
  peso?: number;
  descricao?: string;
}

export interface Premiacao {
  id: string;
  nome: string;
  descricao: string | null;
  premio_descricao: string;
  premio_valor: number | null;
  bu: BusinessUnit;
  cargos_elegiveis: string[];
  tipo_competicao: TipoCompeticao;
  metrica_ranking: MetricaRanking;
  metrica_config: MetricaConfig;
  data_inicio: string;
  data_fim: string;
  qtd_ganhadores: number;
  status: PremiacaoStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PremiacaoGanhador {
  id: string;
  premiacao_id: string;
  posicao: number;
  employee_id: string | null;
  squad: string | null;
  valor_final: number | null;
  premio_recebido: string | null;
  created_at: string;
}

export interface PremiacaoFormData {
  nome: string;
  descricao: string;
  premio_descricao: string;
  premio_valor?: number;
  bu: BusinessUnit | '';
  cargos_elegiveis: string[];
  tipo_competicao: TipoCompeticao;
  metrica_ranking: MetricaRanking;
  metrica_config: MetricaConfig;
  data_inicio: Date;
  data_fim: Date;
  qtd_ganhadores: number;
}

export interface ParticipanteRanking {
  id: string;
  nome: string;
  cargo: string;
  squad?: string;
  valor: number;
  posicao: number;
  avatarUrl?: string;
}

export const METRICAS_OPTIONS: { value: MetricaRanking; label: string; descricao: string }[] = [
  { value: 'agendamentos', label: 'R1 Agendadas', descricao: 'Total de reuniões agendadas' },
  { value: 'realizadas', label: 'R1 Realizadas', descricao: 'Reuniões efetivamente realizadas' },
  { value: 'contratos', label: 'Contratos Pagos', descricao: 'Contratos pagos atribuídos' },
  { value: 'tentativas', label: 'Tentativas de Ligação', descricao: 'Total de tentativas de ligação' },
  { value: 'no_show_inverso', label: 'Menor No-Show', descricao: 'Menor taxa de no-show = melhor posição' },
  { value: 'taxa_conversao', label: 'Taxa de Conversão (%)', descricao: 'contratos/realizadas × 100' },
  { value: 'ote_pct', label: 'OTE Atingido (%)', descricao: '% de OTE atingido no período' },
];

export const CARGOS_ELEGIVEIS_OPTIONS = [
  { value: 'sdr', label: 'SDR' },
  { value: 'closer', label: 'Closer' },
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'analista', label: 'Analista' },
];
