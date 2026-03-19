export type BillingSubscriptionStatus = 'em_dia' | 'atrasada' | 'cancelada' | 'finalizada' | 'quitada';
export type BillingQuitacaoStatus = 'em_aberto' | 'parcialmente_pago' | 'quitado';
export type BillingInstallmentStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado';
export type BillingAgreementStatus = 'em_aberto' | 'em_andamento' | 'cumprido' | 'quebrado';
export type BillingHistoryType = 'entrada_paga' | 'parcela_paga' | 'parcela_atrasada' | 'boleto_gerado' | 'tentativa_cobranca' | 'acordo_realizado' | 'cancelamento' | 'quitacao' | 'observacao';
export type BillingPaymentMethod = 'pix' | 'credit_card' | 'bank_slip' | 'boleto' | 'outro' | 'boleto_parcelado' | 'cartao_parcelado' | 'pix_parcelado';

export type BillingReceivableStatus = 'pendente' | 'recebido';

export interface BillingPaymentReceivable {
  id: string;
  installment_id: string;
  numero: number;
  valor: number;
  data_prevista: string;
  data_recebimento: string | null;
  status: BillingReceivableStatus;
  forma_pagamento: BillingPaymentMethod | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingSubscription {
  id: string;
  customer_email: string | null;
  customer_name: string;
  customer_phone: string | null;
  deal_id: string | null;
  contact_id: string | null;
  product_name: string;
  product_category: string | null;
  valor_entrada: number;
  valor_total_contrato: number;
  total_parcelas: number;
  forma_pagamento: BillingPaymentMethod;
  status: BillingSubscriptionStatus;
  status_quitacao: BillingQuitacaoStatus;
  data_inicio: string | null;
  data_fim_prevista: string | null;
  responsavel_financeiro: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface BillingInstallment {
  id: string;
  subscription_id: string;
  numero_parcela: number;
  valor_original: number;
  valor_pago: number;
  valor_liquido: number;
  data_vencimento: string;
  data_pagamento: string | null;
  forma_pagamento: BillingPaymentMethod | null;
  status: BillingInstallmentStatus;
  hubla_transaction_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingAgreement {
  id: string;
  subscription_id: string;
  responsavel: string;
  data_negociacao: string;
  motivo_negociacao: string | null;
  valor_original_divida: number;
  novo_valor_negociado: number;
  quantidade_parcelas: number;
  forma_pagamento: BillingPaymentMethod;
  data_primeiro_vencimento: string | null;
  status: BillingAgreementStatus;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BillingAgreementInstallment {
  id: string;
  agreement_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: BillingInstallmentStatus;
  created_at: string;
  updated_at: string;
}

export interface BillingHistoryItem {
  id: string;
  subscription_id: string;
  tipo: BillingHistoryType;
  valor: number | null;
  forma_pagamento: BillingPaymentMethod | null;
  status: string | null;
  responsavel: string | null;
  descricao: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface BillingFilters {
  status?: BillingSubscriptionStatus | 'todos';
  statusCobranca?: BillingInstallmentStatus | 'todos';
  formaPagamento?: BillingPaymentMethod | 'todos';
  responsavel?: string;
  vencimentoDe?: string;
  vencimentoAte?: string;
  comAcordo?: boolean;
  inadimplentes?: boolean;
  quitados?: boolean;
  search?: string;
  product?: string;
  category?: string;
}

export interface BillingKPIs {
  valorTotalContratado: number;
  valorTotalPago: number;
  saldoDevedor: number;
  assinaturasAtivas: number;
  assinaturasAtrasadas: number;
  assinaturasQuitadas: number;
  parcelasPagas: number;
  parcelasTotais: number;
}

export const SUBSCRIPTION_STATUS_LABELS: Record<BillingSubscriptionStatus, string> = {
  em_dia: 'Em dia',
  atrasada: 'Atrasada',
  cancelada: 'Cancelada',
  finalizada: 'Finalizada',
  quitada: 'Quitada',
};

export const QUITACAO_STATUS_LABELS: Record<BillingQuitacaoStatus, string> = {
  em_aberto: 'Em aberto',
  parcialmente_pago: 'Parcialmente pago',
  quitado: 'Quitado',
};

export const INSTALLMENT_STATUS_LABELS: Record<BillingInstallmentStatus, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
};

export const AGREEMENT_STATUS_LABELS: Record<BillingAgreementStatus, string> = {
  em_aberto: 'Em aberto',
  em_andamento: 'Em andamento',
  cumprido: 'Cumprido',
  quebrado: 'Quebrado',
};

export const PAYMENT_METHOD_LABELS: Record<BillingPaymentMethod, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  bank_slip: 'Boleto Bancário',
  boleto: 'Boleto',
  outro: 'Outro',
};

export const HISTORY_TYPE_LABELS: Record<BillingHistoryType, string> = {
  entrada_paga: 'Entrada paga',
  parcela_paga: 'Parcela paga',
  parcela_atrasada: 'Parcela em atraso',
  boleto_gerado: 'Boleto gerado',
  tentativa_cobranca: 'Tentativa de cobrança',
  acordo_realizado: 'Acordo realizado',
  cancelamento: 'Cancelamento',
  quitacao: 'Quitação',
  observacao: 'Observação',
};
