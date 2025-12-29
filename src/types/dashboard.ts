export type EvolutionData = {
  periodo: string; // "2025-W01" (usando semana customizada sábado-sexta)
  semanaLabel: string; // "04/01 - 10/01/2025"
  faturamento: number;
  custos: number;
  lucro: number;
  roi: number;
  roas: number;
  vendasA010: number;
  vendasContratos: number;
  leads: number;
};

export type DashboardWidget = 
  | 'kpis'
  | 'ultrameta'
  | 'funil-a010'
  | 'funil-instagram'
  | 'resumo-financeiro'
  | 'grafico-evolucao'
  | 'alertas-recentes'
  | 'comparacao-periodos';

export type DashboardPreferences = {
  id: string;
  user_id: string;
  visible_widgets: DashboardWidget[];
  widgets_order: DashboardWidget[];
  default_period: 'semana' | 'mes';
  default_canal: string;
  auto_refresh: boolean;
  refresh_interval: number;
  funnel_stages?: string[];
  theme?: 'dark' | 'light';
  font_size?: 'small' | 'medium' | 'large';
  created_at: string;
  updated_at: string;
};

export type DashboardTemplate = {
  name: string;
  description: string;
  widgets: DashboardWidget[];
};

export type Alert = {
  id: string;
  tipo: 'critico' | 'aviso' | 'info';
  titulo: string;
  descricao: string | null;
  lido: boolean;
  resolvido: boolean;
  user_id: string;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

export type ComparisonPeriod = {
  label: string;
  inicio: Date;
  fim: Date;
};

export type ComparisonMetric = {
  name: string;
  periodA: number;
  periodB: number;
  diff: number;
  diffPercent: number;
  isPositive: boolean;
};
