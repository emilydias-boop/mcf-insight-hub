export type TransferStatusFase =
  | 'precificacao'
  | 'comprador'
  | 'analise_credito'
  | 'documentacao'
  | 'transferencia_oficial'
  | 'financeiro'
  | 'concluida'
  | 'cancelada';

export type TransferTipoContemplacao =
  | 'sorteio_50'
  | 'sorteio_25'
  | 'lance_50'
  | 'lance_25'
  | 'lance_fixo';

export type TransferAnaliseStatus = 'pendente' | 'em_analise' | 'aprovado' | 'reprovado';

export type TransferFinancialTipo =
  | 'entrada_comprador'
  | 'repasse_consorciado'
  | 'comissao_empresa'
  | 'taxa_administradora';

export type TransferFinancialStatus = 'previsto' | 'recebido' | 'pago' | 'cancelado';

export type PosContemplacaoDecisao =
  | 'manter'
  | 'a_venda'
  | 'em_transferencia'
  | 'transferida';

export interface ConsortiumTransfer {
  id: string;
  card_id: string;
  status_fase: TransferStatusFase;
  tipo_contemplacao: TransferTipoContemplacao | null;
  usou_capital_proprio: boolean;
  valor_capital_proprio: number | null;
  data_assembleia: string | null;
  valor_lance: number | null;
  valor_credito_disponivel: number | null;
  valor_total_comprador: number | null;
  valor_comissao_empresa: number | null;
  valor_repasse_consorciado: number | null;
  observacoes_precificacao: string | null;
  analise_status: TransferAnaliseStatus;
  analise_data: string | null;
  analise_observacao: string | null;
  protocolo_admin: string | null;
  data_envio_admin: string | null;
  data_efetivacao: string | null;
  nova_cota: string | null;
  iniciado_em: string;
  concluido_em: string | null;
  cancelado_em: string | null;
  motivo_cancelamento: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsortiumTransferBuyer {
  id: string;
  transfer_id: string;
  tipo_pessoa: 'pf' | 'pj';
  nome_completo: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  estado_civil: string | null;
  profissao: string | null;
  renda: number | null;
  razao_social: string | null;
  cnpj: string | null;
  natureza_juridica: string | null;
  inscricao_estadual: string | null;
  data_fundacao: string | null;
  faturamento_mensal: number | null;
  endereco_cep: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
}

export interface ConsortiumTransferFinancial {
  id: string;
  transfer_id: string;
  tipo: TransferFinancialTipo;
  valor: number;
  data_prevista: string | null;
  data_realizada: string | null;
  status: TransferFinancialStatus;
  observacao: string | null;
}

export interface ConsortiumTransferDocument {
  id: string;
  transfer_id: string;
  tipo: string;
  nome_arquivo: string;
  storage_path: string | null;
  storage_url: string | null;
  uploaded_at: string;
}

export const TRANSFER_FASE_OPTIONS: { value: TransferStatusFase; label: string }[] = [
  { value: 'precificacao', label: 'Precificação' },
  { value: 'comprador', label: 'Comprador' },
  { value: 'analise_credito', label: 'Análise de Crédito' },
  { value: 'documentacao', label: 'Documentação' },
  { value: 'transferencia_oficial', label: 'Transferência Oficial' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

export const TIPO_CONTEMPLACAO_OPTIONS: { value: TransferTipoContemplacao; label: string }[] = [
  { value: 'sorteio_50', label: 'Sorteio 50%' },
  { value: 'sorteio_25', label: 'Sorteio 25%' },
  { value: 'lance_50', label: 'Lance 50%' },
  { value: 'lance_25', label: 'Lance 25%' },
  { value: 'lance_fixo', label: 'Lance Fixo' },
];

export const TRANSFER_FINANCIAL_TIPO_OPTIONS: { value: TransferFinancialTipo; label: string }[] = [
  { value: 'entrada_comprador', label: 'Entrada do Comprador' },
  { value: 'repasse_consorciado', label: 'Repasse ao Consorciado' },
  { value: 'comissao_empresa', label: 'Comissão da Empresa' },
  { value: 'taxa_administradora', label: 'Taxa da Administradora' },
];