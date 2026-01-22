export interface CargoMetricaConfig {
  id: string;
  cargo_catalogo_id: string;
  squad: string | null;
  nome_metrica: string;
  label_exibicao: string;
  peso_percentual: number;
  tipo_calculo: string;
  fonte_dados: string | null;
  meta_padrao: number | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganogramaNode {
  id: string;
  cargo_catalogo_id: string | null;
  parent_id: string | null;
  squad: string | null;
  departamento: string | null;
  posicao_ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  // Join data
  cargo?: {
    id: string;
    nome_exibicao: string;
    cargo_base: string;
    area: string;
  };
  children?: OrganogramaNode[];
}

export interface CargoCatalogo {
  id: string;
  nome_exibicao: string;
  cargo_base: string;
  area: string;
  nivel: number | null;
  fixo_valor: number;
  variavel_valor: number;
  ote_total: number;
  ativo: boolean;
}

export const FONTES_DADOS = [
  { value: 'meeting_slot_attendees', label: 'Agenda (Attendees)' },
  { value: 'meeting_slots', label: 'Agenda (Slots)' },
  { value: 'calls', label: 'Ligações Twilio' },
  { value: 'hubla_transactions', label: 'Vendas Hubla' },
  { value: 'manual', label: 'Entrada Manual' },
  { value: 'calculated', label: 'Fórmula Calculada' },
] as const;

export const TIPOS_CALCULO = [
  { value: 'contagem', label: 'Contagem' },
  { value: 'valor', label: 'Valor' },
  { value: 'percentual', label: 'Percentual' },
] as const;

export const SQUADS = [
  { value: 'incorporador', label: 'Incorporador' },
  { value: 'consorcio', label: 'Consórcio' },
  { value: 'credito', label: 'Crédito' },
  { value: 'projetos', label: 'Projetos' },
] as const;
