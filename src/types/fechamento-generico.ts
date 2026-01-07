// Types for the generic closing module (matching actual DB schema)

export interface CargoCatalogo {
  id: string;
  cargo_base: string;
  nome_exibicao: string;
  area: string;
  nivel: number | null;
  fixo_valor: number;
  variavel_valor: number;
  ote_total: number;
  modelo_variavel: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReguaMultiplicador {
  id: string;
  nome_regua: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReguaFaixa {
  id: string;
  regua_id: string;
  faixa_de: number;
  faixa_ate: number;
  multiplicador: number;
  ordem: number;
  created_at: string;
}

export interface MetaMes {
  id: string;
  competencia: string; // format: YYYY-MM
  area: string;
  cargo_base: string;
  nivel: number | null;
  cargo_catalogo_id: string | null;
  regua_id: string | null;
  ativo: boolean;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface MetaComponente {
  id: string;
  meta_mes_id: string;
  nome_componente: string;
  valor_base: number;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

export interface FechamentoMes {
  id: string;
  competencia: string; // format: YYYY-MM
  status: string;
  criado_por: string | null;
  criado_em: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  observacao_geral: string | null;
  created_at: string;
  updated_at: string;
}

export interface FechamentoPessoa {
  id: string;
  fechamento_mes_id: string;
  employee_id: string;
  cargo_catalogo_id: string | null;
  regua_id: string | null;
  fixo_valor: number;
  variavel_bruto: number;
  multiplicador_final: number;
  variavel_final: number;
  total_a_pagar: number;
  status: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface FechamentoComponenteRealizado {
  id: string;
  fechamento_pessoa_id: string;
  meta_componente_id: string;
  valor_realizado: number;
  pct_atingido: number;
  multiplicador: number;
  valor_calculado: number;
  created_at: string;
}

export interface AuditoriaFechamento {
  id: string;
  entidade: string;
  entidade_id: string;
  acao: string;
  antes_json: Record<string, unknown> | null;
  depois_json: Record<string, unknown> | null;
  motivo: string | null;
  usuario_id: string | null;
  created_at: string;
}

// Labels and mappings
export const FECHAMENTO_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-yellow-500' },
  em_revisao: { label: 'Em Revisão', color: 'bg-blue-500' },
  aprovado: { label: 'Aprovado', color: 'bg-green-500' },
  pago: { label: 'Pago', color: 'bg-purple-500' },
};

export const PESSOA_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-yellow-500' },
  em_revisao: { label: 'Em Revisão', color: 'bg-blue-500' },
  aprovado: { label: 'Aprovado', color: 'bg-green-500' },
  pago: { label: 'Pago', color: 'bg-purple-500' },
};

export const AREA_OPTIONS = [
  'ADM',
  'Comercial',
  'Marketing',
  'Operações',
  'Financeiro',
  'RH',
  'Outro',
];

export const MODELO_VARIAVEL_OPTIONS = [
  { value: 'nenhum', label: 'Nenhum' },
  { value: 'pct_faturamento', label: '% sobre faturamento' },
  { value: 'comissao_contrato', label: 'Comissão por contrato' },
  { value: 'modelo_sdr', label: 'Modelo SDR' },
  { value: 'componentes', label: 'Por componentes' },
];
