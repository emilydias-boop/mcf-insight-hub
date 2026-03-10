// Tipos para o módulo de Gerentes de Relacionamento (GR)

// Enums
export type GREntryStatus = 
  | 'ativo' 
  | 'em_negociacao' 
  | 'em_pausa' 
  | 'convertido' 
  | 'inativo' 
  | 'transferido';

export type GRActionType = 
  | 'reuniao_agendada'
  | 'reuniao_realizada'
  | 'diagnostico'
  | 'produto_sugerido'
  | 'produto_contratado'
  | 'nota'
  | 'encaminhamento_bu'
  | 'status_change'
  | 'contato_telefonico'
  | 'contato_whatsapp';

export type GRDistributionMode = 'automatico' | 'manual';

// Carteira do GR
export interface GRWallet {
  id: string;
  gr_user_id: string;
  bu: string;
  is_open: boolean;
  max_capacity: number;
  current_count: number;
  created_at: string;
  updated_at: string;
  // Joined data
  gr_name?: string;
  gr_email?: string;
}

// Entrada na carteira (cliente)
export interface GRWalletEntry {
  id: string;
  wallet_id: string;
  deal_id: string | null;
  contact_id: string | null;
  transaction_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  status: GREntryStatus;
  entry_source: string;
  product_purchased: string | null;
  purchase_value: number | null;
  assigned_by: string | null;
  entry_date: string;
  last_contact_at: string | null;
  next_action_date: string | null;
  financial_profile: Record<string, any>;
  recommended_products: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  wallet?: GRWallet;
  gr_name?: string;
}

// Ação do GR
export interface GRAction {
  id: string;
  entry_id: string;
  action_type: GRActionType;
  description: string | null;
  metadata: Record<string, any>;
  performed_by: string;
  created_at: string;
  // Joined data
  performer_name?: string;
}

// Log de transferência
export interface GRTransferLog {
  id: string;
  entry_id: string;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  reason: string | null;
  transferred_by: string;
  created_at: string;
  // Joined data
  from_gr_name?: string;
  to_gr_name?: string;
  transferred_by_name?: string;
}

// Regras de distribuição
export interface GRDistributionRule {
  id: string;
  bu: string;
  mode: GRDistributionMode;
  balance_type: string;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Labels para status
export const GR_STATUS_LABELS: Record<GREntryStatus, { label: string; color: string }> = {
  ativo: { label: 'Ativo', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  em_negociacao: { label: 'Em Negociação', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  em_pausa: { label: 'Em Pausa', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  convertido: { label: 'Convertido', color: 'bg-primary/20 text-primary border-primary/30' },
  inativo: { label: 'Inativo', color: 'bg-muted text-muted-foreground border-border' },
  transferido: { label: 'Transferido', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

// Labels para tipos de ação
export const GR_ACTION_LABELS: Record<GRActionType, { label: string; icon: string }> = {
  reuniao_agendada: { label: 'Reunião Agendada', icon: '📅' },
  reuniao_realizada: { label: 'Reunião Realizada', icon: '✅' },
  diagnostico: { label: 'Diagnóstico', icon: '🔍' },
  produto_sugerido: { label: 'Produto Sugerido', icon: '💡' },
  produto_contratado: { label: 'Produto Contratado', icon: '🎉' },
  nota: { label: 'Nota', icon: '📝' },
  encaminhamento_bu: { label: 'Encaminhamento BU', icon: '➡️' },
  status_change: { label: 'Mudança de Status', icon: '🔄' },
  contato_telefonico: { label: 'Contato Telefônico', icon: '📞' },
  contato_whatsapp: { label: 'Contato WhatsApp', icon: '💬' },
};

// Produtos que o GR pode sugerir
export const GR_PRODUCTS = [
  { code: 'consorcio', name: 'Consórcio', bu: 'consorcio' },
  { code: 'he', name: 'Home Equity', bu: 'credito' },
  { code: 'ip', name: 'Incorporação Própria', bu: 'incorporador' },
  { code: 'cp', name: 'Construção Própria', bu: 'incorporador' },
  { code: 'clube', name: 'The Club', bu: 'incorporador' },
  { code: 'leilao', name: 'Leilão', bu: 'leilao' },
  { code: 'outro', name: 'Outro', bu: null },
] as const;

// Métricas do GR
export interface GRMetrics {
  total_entries: number;
  ativos: number;
  em_negociacao: number;
  convertidos: number;
  inativos: number;
  taxa_conversao: number;
  tempo_medio_dias: number;
  receita_gerada: number;
}
