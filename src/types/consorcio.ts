export type TipoPessoa = 'pf' | 'pj';
export type ConsorcioStatus = 'ativo' | 'inativo' | 'cancelado' | 'contemplado';
export type TipoProduto = 'select' | 'parcelinha';
export type TipoContrato = 'normal' | 'intercalado';
export type OrigemConsorcio = 'socio' | 'gr' | 'indicacao' | 'outros';
export type EstadoCivil = 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'uniao_estavel';
export type TipoServidor = 'estadual' | 'federal' | 'municipal';
export type TipoDocumento = 'cnh' | 'rg' | 'contrato_social' | 'cartao_cnpj' | 'comprovante_residencia' | 'outro';
export type TipoParcela = 'cliente' | 'empresa';
export type StatusParcela = 'pendente' | 'pago' | 'atrasado';

export interface ConsorcioCard {
  id: string;
  created_at: string;
  updated_at: string;
  tipo_pessoa: TipoPessoa;
  status: ConsorcioStatus;
  
  // Dados da cota
  grupo: string;
  cota: string;
  valor_credito: number;
  prazo_meses: number;
  tipo_produto: TipoProduto;
  tipo_contrato: TipoContrato;
  parcelas_pagas_empresa: number;
  data_contratacao: string;
  dia_vencimento: number;
  
  // Origem
  origem: OrigemConsorcio;
  origem_detalhe?: string;
  
  // Responsável
  vendedor_id?: string;
  vendedor_name?: string;
  
  // Dados PF
  nome_completo?: string;
  data_nascimento?: string;
  cpf?: string;
  rg?: string;
  estado_civil?: EstadoCivil;
  cpf_conjuge?: string;
  endereco_cep?: string;
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  telefone?: string;
  email?: string;
  profissao?: string;
  tipo_servidor?: TipoServidor;
  renda?: number;
  patrimonio?: number;
  pix?: string;
  
  // Dados PJ
  razao_social?: string;
  cnpj?: string;
  natureza_juridica?: string;
  inscricao_estadual?: string;
  data_fundacao?: string;
  endereco_comercial_cep?: string;
  endereco_comercial_rua?: string;
  endereco_comercial_numero?: string;
  endereco_comercial_complemento?: string;
  endereco_comercial_bairro?: string;
  endereco_comercial_cidade?: string;
  endereco_comercial_estado?: string;
  telefone_comercial?: string;
  email_comercial?: string;
  faturamento_mensal?: number;
  num_funcionarios?: number;
}

export interface ConsorcioPartner {
  id: string;
  card_id: string;
  nome: string;
  cpf: string;
  renda?: number;
  created_at: string;
}

export interface ConsorcioDocument {
  id: string;
  card_id: string;
  tipo: TipoDocumento;
  nome_arquivo: string;
  storage_path?: string;
  storage_url?: string;
  uploaded_at: string;
  uploaded_by?: string;
}

export interface ConsorcioInstallment {
  id: string;
  card_id: string;
  numero_parcela: number;
  tipo: TipoParcela;
  valor_parcela: number;
  valor_comissao: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: StatusParcela;
  created_at: string;
  updated_at: string;
}

export interface ConsorcioCardWithDetails extends ConsorcioCard {
  partners?: ConsorcioPartner[];
  documents?: ConsorcioDocument[];
  installments?: ConsorcioInstallment[];
}

export interface ConsorcioSummary {
  totalCartas: number;
  totalCredito: number;
  comissaoTotal: number;
  comissaoRecebida: number;
  comissaoPendente: number;
  cartasSelect: number;
  cartasParcelinha: number;
}

export interface CreateConsorcioCardInput {
  tipo_pessoa: TipoPessoa;
  grupo: string;
  cota: string;
  valor_credito: number;
  prazo_meses: number;
  tipo_produto: TipoProduto;
  tipo_contrato: TipoContrato;
  parcelas_pagas_empresa: number;
  data_contratacao: string;
  dia_vencimento: number;
  origem: OrigemConsorcio;
  origem_detalhe?: string;
  vendedor_id?: string;
  vendedor_name?: string;
  
  // PF fields
  nome_completo?: string;
  data_nascimento?: string;
  cpf?: string;
  rg?: string;
  estado_civil?: EstadoCivil;
  cpf_conjuge?: string;
  endereco_cep?: string;
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  telefone?: string;
  email?: string;
  profissao?: string;
  tipo_servidor?: TipoServidor;
  renda?: number;
  patrimonio?: number;
  pix?: string;
  
  // PJ fields
  razao_social?: string;
  cnpj?: string;
  natureza_juridica?: string;
  inscricao_estadual?: string;
  data_fundacao?: string;
  endereco_comercial_cep?: string;
  endereco_comercial_rua?: string;
  endereco_comercial_numero?: string;
  endereco_comercial_complemento?: string;
  endereco_comercial_bairro?: string;
  endereco_comercial_cidade?: string;
  endereco_comercial_estado?: string;
  telefone_comercial?: string;
  email_comercial?: string;
  faturamento_mensal?: number;
  num_funcionarios?: number;
  
  // Partners (PJ only)
  partners?: Array<{ nome: string; cpf: string; renda?: number }>;
}

export const ESTADO_CIVIL_OPTIONS = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
  { value: 'uniao_estavel', label: 'União Estável' },
] as const;

export const TIPO_SERVIDOR_OPTIONS = [
  { value: 'estadual', label: 'Estadual' },
  { value: 'federal', label: 'Federal' },
  { value: 'municipal', label: 'Municipal' },
] as const;

export const ORIGEM_OPTIONS = [
  { value: 'socio', label: 'Sócio' },
  { value: 'gr', label: 'GR' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'outros', label: 'Outros' },
] as const;

export const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo', color: 'bg-green-500' },
  { value: 'inativo', label: 'Inativo', color: 'bg-gray-500' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-red-500' },
  { value: 'contemplado', label: 'Contemplado', color: 'bg-blue-500' },
] as const;

export const TIPO_DOCUMENTO_OPTIONS = [
  { value: 'cnh', label: 'CNH' },
  { value: 'rg', label: 'RG' },
  { value: 'contrato_social', label: 'Contrato Social' },
  { value: 'cartao_cnpj', label: 'Cartão CNPJ' },
  { value: 'comprovante_residencia', label: 'Comprovante de Residência' },
  { value: 'outro', label: 'Outro' },
] as const;
