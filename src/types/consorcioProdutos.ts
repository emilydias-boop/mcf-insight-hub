export interface ConsorcioProduto {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  faixa_credito_min: number;
  faixa_credito_max: number;
  taxa_antecipada_percentual: number;
  taxa_antecipada_tipo: 'primeira_parcela' | 'dividida_12';
  prazos_disponiveis: number[];
  taxa_adm_200?: number;
  taxa_adm_220?: number;
  taxa_adm_240?: number;
  fundo_reserva: number;
  seguro_vida_percentual: number;
  grupo_padrao?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConsorcioCredito {
  id: string;
  produto_id: string;
  codigo_credito: string;
  valor_credito: number;
  
  // Prazo 240
  parcela_1a_12a_conv_240?: number;
  parcela_demais_conv_240?: number;
  parcela_1a_12a_50_240?: number;
  parcela_demais_50_240?: number;
  parcela_1a_12a_25_240?: number;
  parcela_demais_25_240?: number;
  
  // Prazo 220
  parcela_1a_12a_conv_220?: number;
  parcela_demais_conv_220?: number;
  parcela_1a_12a_50_220?: number;
  parcela_demais_50_220?: number;
  parcela_1a_12a_25_220?: number;
  parcela_demais_25_220?: number;
  
  // Prazo 200
  parcela_1a_12a_conv_200?: number;
  parcela_demais_conv_200?: number;
  parcela_1a_12a_50_200?: number;
  parcela_demais_50_200?: number;
  parcela_1a_12a_25_200?: number;
  parcela_demais_25_200?: number;
  
  ativo: boolean;
  created_at: string;
}

export type CondicaoPagamento = 'convencional' | '50' | '25';
export type PrazoParcelas = 200 | 220 | 240;

export interface CalculoParcela {
  fundoComum: number;
  taxaAdm: number;
  fundoReserva: number;
  seguroVida: number;
  taxaAntecipada: number;
  parcela1a12: number;
  parcelaDemais: number;
  totalPago: number;
  usandoTabelaOficial?: boolean;
}

export const CONDICAO_PAGAMENTO_OPTIONS = [
  { value: 'convencional', label: 'Convencional' },
  { value: '50', label: 'Mais por Menos 50%' },
  { value: '25', label: 'Mais por Menos 25%' },
] as const;

export const PRAZO_OPTIONS = [
  { value: 200, label: '200 meses' },
  { value: 220, label: '220 meses' },
  { value: 240, label: '240 meses' },
] as const;
