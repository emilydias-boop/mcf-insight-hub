export interface CreditProduct {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreditStage {
  id: string;
  product_id: string;
  name: string;
  color: string;
  stage_order: number;
  is_final: boolean;
  is_won: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreditPartner {
  id: string;
  full_name: string;
  cpf_cnpj: string;
  email: string | null;
  phone: string | null;
  tipo: 'capital_proprio' | 'carta_consorcio';
  valor_aportado: number;
  consorcio_card_id: string | null;
  status: 'prospect' | 'negociacao' | 'documentacao' | 'ativo' | 'inativo';
  data_entrada: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditDeal {
  id: string;
  product_id: string;
  stage_id: string;
  client_id: string | null;
  partner_id: string | null;
  titulo: string;
  valor_solicitado: number;
  valor_aprovado: number | null;
  taxa_juros: number | null;
  prazo_meses: number | null;
  garantia: string | null;
  data_solicitacao: string;
  data_aprovacao: string | null;
  data_liberacao: string | null;
  data_quitacao: string | null;
  owner_id: string | null;
  observacoes: string | null;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Joined fields
  product?: CreditProduct;
  stage?: CreditStage;
  client?: CreditClient;
  partner?: CreditPartner;
}

export interface CreditClient {
  id: string;
  full_name: string;
  cpf: string;
  email: string | null;
  phone: string | null;
  credit_score: number | null;
  total_credit: number | null;
  total_debt: number | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditDealActivity {
  id: string;
  deal_id: string;
  activity_type: string;
  from_stage_id: string | null;
  to_stage_id: string | null;
  description: string | null;
  user_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export type PartnerStatus = 'prospect' | 'negociacao' | 'documentacao' | 'ativo' | 'inativo';
export type PartnerTipo = 'capital_proprio' | 'carta_consorcio';
