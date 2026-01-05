export type SetorType = 'inside' | 'consorcio' | 'projetos' | 'renovacoes' | 'outros';

export interface SetorConfig {
  id: SetorType;
  name: string;
  icon: string;
  description: string;
  categories: string[];
}

export const SETORES_CONFIG: Record<SetorType, SetorConfig> = {
  inside: {
    id: 'inside',
    name: 'Inside',
    icon: '💼',
    description: 'Cursos e produtos digitais',
    categories: [
      'a010', 'a001', 'contrato', 'parceria', 
      'ob_vitalicio', 'ob_construir', 'ob_evento', 'ob_construir_alugar',
      'imersao', 'imersao_socios', 'efeito_alavanca', 'incorporador'
    ]
  },
  consorcio: {
    id: 'consorcio',
    name: 'Consórcio',
    icon: '🏠',
    description: 'Cartas de consórcio',
    categories: ['consorcio']
  },
  projetos: {
    id: 'projetos',
    name: 'Projetos',
    icon: '📐',
    description: 'Projetos arquitetônicos',
    categories: ['projeto']
  },
  renovacoes: {
    id: 'renovacoes',
    name: 'Renovações',
    icon: '🔄',
    description: 'Renovações de assinaturas',
    categories: ['renovacao']
  },
  outros: {
    id: 'outros',
    name: 'Outros',
    icon: '📦',
    description: 'Outros produtos',
    categories: ['outros', 'clube_arremate', 'viver_aluguel']
  }
};

export interface SetorSummary {
  setor: SetorType;
  total: number;
  quantidade: number;
  ticketMedio: number;
  variacao: number; // percentual em relação ao período anterior
  totalAnterior: number;
}

export interface ProductSummary {
  category: string;
  categoryLabel: string;
  total: number;
  quantidade: number;
  ticketMedio: number;
  variacao: number;
}

export interface PersonPerformance {
  id: string;
  name: string;
  email?: string;
  role: 'sdr' | 'closer' | 'vendedor';
  total: number;
  quantidade: number;
  ticketMedio: number;
  variacao: number;
}

export interface PeriodFilter {
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
  label: string;
}

export interface ConsorcioCard {
  id: string;
  consorciado: string;
  contrato: string | null;
  parcela: number | null;
  valor_comissao: number | null;
  data_interface: string | null;
  vendedor_id: string | null;
  vendedor_name: string | null;
  status: string | null;
}
