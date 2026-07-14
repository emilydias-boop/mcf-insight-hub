export type ArTituloTipo = 'integral' | 'parcelado' | 'pendente_lancamento';
export type ArTituloStatus = 'aberto' | 'quitado' | 'cancelado';
export type ArParcelaTipo = 'entrada' | 'parcela';
export type ArParcelaStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado';
export type ArCobrancaStage = 'mes' | 'atraso' | 'judicial';

export const AR_COBRANCA_STAGE_LABEL: Record<ArCobrancaStage, string> = {
  mes: 'Cobrança do mês',
  atraso: 'Cobrança em atraso',
  judicial: 'Cobrança judicial',
};

export interface ArTitulo {
  id: string;
  hubla_transaction_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  product_name: string;
  product_code: string | null;
  valor_total: number;
  payment_method: string | null;
  total_installments_hubla: number;
  tipo: ArTituloTipo;
  status: ArTituloStatus;
  responsavel_id: string | null;
  sale_date: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // enriched
  valor_pago?: number;
  valor_pendente?: number;
  parcelas_pagas?: number;
  parcelas_total?: number;
  cobranca_stage?: ArCobrancaStage | null;
  cobranca_stage_manual?: boolean;
  cobranca_stage_updated_at?: string | null;
  // enriched (kanban)
  stage_effective?: ArCobrancaStage;
  proxima_parcela?: string | null;
  dias_atraso?: number;
}

export interface ArParcela {
  id: string;
  titulo_id: string;
  numero: number;
  tipo_parcela: ArParcelaTipo;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  forma_pagamento: string | null;
  status: ArParcelaStatus;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArHistorico {
  id: string;
  titulo_id: string;
  parcela_id: string | null;
  tipo: string;
  descricao: string | null;
  valor: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

export const AR_TITULO_TIPO_LABEL: Record<ArTituloTipo, string> = {
  integral: 'Integral',
  parcelado: 'Parcelado',
  pendente_lancamento: 'Pendente de lançamento',
};

export const AR_TITULO_STATUS_LABEL: Record<ArTituloStatus, string> = {
  aberto: 'Em aberto',
  quitado: 'Quitado',
  cancelado: 'Cancelado',
};

export const AR_PARCELA_STATUS_LABEL: Record<ArParcelaStatus, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
};

export const AR_PARCELA_TIPO_LABEL: Record<ArParcelaTipo, string> = {
  entrada: 'Entrada',
  parcela: 'Parcela',
};