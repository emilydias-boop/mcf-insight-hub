import { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type FlagType = Database["public"]["Enums"]["flag_type"];
export type FlagCategory = Database["public"]["Enums"]["flag_category"];
export type TargetType = Database["public"]["Enums"]["target_type"];
export type TargetPeriod = Database["public"]["Enums"]["target_period"];
export type PermissionLevel = Database["public"]["Enums"]["permission_level"];
export type ResourceType = Database["public"]["Enums"]["resource_type"];

// ===== STATUS DE ACESSO (novo) =====
export type AccessStatus = "ativo" | "bloqueado" | "desativado";

// Status de emprego (legado - para módulo RH futuro)
export type UserStatus = "ativo" | "ferias" | "inativo" | "pendente_aprovacao";

export interface UserSummary {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole | null;
  position: string | null;
  department: string | null;
  hire_date: string | null;
  is_active: boolean | null;
  status: UserStatus | null;
  fixed_salary: number | null;
  ote: number | null;
  commission_rate: number | null;
}

export interface UserDetails {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole | null;
  created_at: string | null;
  // Novos campos de acesso
  access_status: AccessStatus | null;
  blocked_until: string | null;
  last_login_at: string | null;
  squad: string[] | null;
  // Employment (legado - para módulo RH)
  employment: {
    position: string | null;
    department: string | null;
    hire_date: string | null;
    termination_date: string | null;
    fixed_salary: number | null;
    ote: number | null;
    commission_rate: number | null;
    is_active: boolean | null;
    status: UserStatus | null;
  } | null;
}

// ===== INTEGRAÇÕES DE USUÁRIO (novo) =====
export interface UserIntegration {
  id: string;
  user_id: string;
  clint_user_id: string | null;
  twilio_agent_id: string | null;
  other_integrations: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UserTarget {
  id: string;
  user_id: string;
  name: string;
  type: TargetType;
  period: TargetPeriod;
  target_value: number;
  current_value: number | null;
  start_date: string;
  end_date: string;
  is_achieved: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface UserFlag {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  flag_type: FlagType;
  category: FlagCategory;
  severity: number | null;
  is_resolved: boolean | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface UserObservation {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string | null;
  is_important: boolean | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  resource: ResourceType;
  permission_level: PermissionLevel;
  restrictions: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

// ===== ARQUIVOS DE USUÁRIO =====
export type UserFileType = "contrato_trabalho" | "politica_comissao" | "metas" | "outro";

export interface UserFile {
  id: string;
  user_id: string;
  tipo: UserFileType;
  titulo: string;
  descricao: string | null;
  storage_url: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  data_upload: string;
  uploaded_by: string;
  visivel_para_usuario: boolean;
  categoria_cargo: string | null;
  created_at: string;
  updated_at: string;
  // Campo de join para exibição
  uploader_name?: string;
}

export const USER_FILE_TYPE_LABELS: Record<UserFileType, string> = {
  contrato_trabalho: "Contrato de Trabalho",
  politica_comissao: "Política de Comissão",
  metas: "Metas",
  outro: "Outro",
};

// ===== LABELS AMIGÁVEIS =====
export const ACCESS_STATUS_LABELS: Record<AccessStatus, { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  bloqueado: { label: "Bloqueado", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  desativado: { label: "Desativado", color: "bg-muted text-muted-foreground border-border" },
};

export const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-primary/20 text-primary border-primary/30" },
  manager: { label: "Manager", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  coordenador: { label: "Coordenador", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  sdr: { label: "SDR", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  closer: { label: "Closer", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  closer_sombra: { label: "Closer Sombra", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  viewer: { label: "Viewer", color: "bg-muted text-muted-foreground border-border" },
  financeiro: { label: "Financeiro", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  rh: { label: "RH", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
};

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  dashboard: "Dashboard Master",
  receita: "Financeiro (Receita)",
  custos: "Financeiro (Custos)",
  relatorios: "Relatórios",
  alertas: "Alertas",
  efeito_alavanca: "Efeito Alavanca",
  projetos: "Projetos",
  credito: "Crédito",
  leilao: "Leilão",
  configuracoes: "Configurações",
  crm: "CRM",
  fechamento_sdr: "Fechamento Equipe",
  tv_sdr: "TV SDR",
  usuarios: "Gestão de Usuários",
  financeiro: "Módulo Financeiro",
  patrimonio: "Patrimônio (TI)",
  agenda_r2: "Agenda R2",
};
