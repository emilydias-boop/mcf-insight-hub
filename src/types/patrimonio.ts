// Central de Controle de Patrimônio - Types

// Enums matching database
export type AssetType = 'notebook' | 'desktop' | 'monitor' | 'celular' | 'tablet' | 'impressora' | 'outro';
export type AssetStatus = 'em_estoque' | 'em_uso' | 'em_manutencao' | 'devolvido' | 'baixado';
export type AssetEventType = 'comprado' | 'liberado' | 'transferido' | 'manutencao' | 'devolucao' | 'baixa';
export type AssignmentStatus = 'ativo' | 'devolvido' | 'transferido';

// Display labels
export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  notebook: 'Notebook',
  desktop: 'Desktop',
  monitor: 'Monitor',
  celular: 'Celular',
  tablet: 'Tablet',
  impressora: 'Impressora',
  outro: 'Outro',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  em_estoque: 'Em Estoque',
  em_uso: 'Em Uso',
  em_manutencao: 'Em Manutenção',
  devolvido: 'Devolvido',
  baixado: 'Baixado',
};

export const ASSET_EVENT_LABELS: Record<AssetEventType, string> = {
  comprado: 'Comprado',
  liberado: 'Liberado',
  transferido: 'Transferido',
  manutencao: 'Manutenção',
  devolucao: 'Devolução',
  baixa: 'Baixa',
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  ativo: 'Ativo',
  devolvido: 'Devolvido',
  transferido: 'Transferido',
};

// Checklist item types
export const CHECKLIST_ITEMS = [
  { id: 'mouse', label: 'Mouse' },
  { id: 'carregador', label: 'Carregador' },
  { id: 'headset', label: 'Headset' },
  { id: 'teclado', label: 'Teclado' },
  { id: 'mochila', label: 'Mochila' },
  { id: 'outro', label: 'Outro' },
] as const;

// Main interfaces
export interface Asset {
  id: string;
  numero_patrimonio: string;
  tipo: AssetType;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  sistema_operacional: string | null;
  data_compra: string | null;
  fornecedor: string | null;
  nota_fiscal_url: string | null;
  nota_fiscal_path: string | null;
  status: AssetStatus;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface AssetAssignment {
  id: string;
  asset_id: string;
  employee_id: string;
  setor: string | null;
  cargo: string | null;
  data_liberacao: string;
  data_prevista_devolucao: string | null;
  data_devolucao_real: string | null;
  status: AssignmentStatus;
  termo_id: string | null;
  created_at: string;
  created_by: string | null;
}

export interface AssetAssignmentItem {
  id: string;
  assignment_id: string;
  item_tipo: string;
  descricao: string | null;
  conferido_devolucao: boolean;
  observacao_devolucao: string | null;
}

export interface AssetTerm {
  id: string;
  assignment_id: string | null;
  asset_id: string;
  employee_id: string;
  termo_conteudo: string;
  aceito: boolean;
  data_aceite: string | null;
  ip_aceite: string | null;
  assinatura_digital: string | null;
  bloqueado: boolean;
  storage_path: string | null;
  created_at: string;
}

export interface AssetHistory {
  id: string;
  asset_id: string;
  tipo_evento: AssetEventType;
  descricao: string | null;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
  profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

// Extended types with relations
export interface AssetWithAssignment extends Asset {
  current_assignment?: AssetAssignment & {
    employee?: {
      id: string;
      nome_completo: string;
      email_pessoal: string | null;
      departamento: string | null;
      cargo: string | null;
    };
  };
}

export interface AssetAssignmentWithDetails extends AssetAssignment {
  asset?: Asset;
  employee?: {
    id: string;
    nome_completo: string;
    email_pessoal: string | null;
    departamento: string | null;
    cargo: string | null;
  };
  items?: AssetAssignmentItem[];
  termo?: AssetTerm;
}

// Form types
export interface CreateAssetInput {
  numero_patrimonio: string;
  tipo: AssetType;
  marca?: string;
  modelo?: string;
  numero_serie?: string;
  sistema_operacional?: string;
  data_compra?: string;
  fornecedor?: string;
  observacoes?: string;
}

export interface UpdateAssetInput extends Partial<CreateAssetInput> {
  status?: AssetStatus;
}

export interface CreateAssignmentInput {
  asset_id: string;
  employee_id: string;
  data_liberacao: string;
  data_prevista_devolucao?: string;
  items: { item_tipo: string; descricao?: string }[];
  observacoes?: string;
}

export interface ReturnAssignmentInput {
  assignment_id: string;
  items_conferidos: { 
    item_id: string; 
    conferido: boolean; 
    observacao?: string 
  }[];
  novo_status: 'em_estoque' | 'em_manutencao';
  observacoes?: string;
}

// Stats type for dashboard
export interface AssetStats {
  total: number;
  em_estoque: number;
  em_uso: number;
  em_manutencao: number;
  devolvido: number;
  baixado: number;
}
