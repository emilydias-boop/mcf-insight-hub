export type PlaybookRole = 'sdr' | 'closer' | 'coordenador' | 'gestor_sdr' | 'gestor_closer' | 'master' | 'admin' | 'manager' | 'viewer';
export type PlaybookCategoria = 'onboarding' | 'processo' | 'politica' | 'script' | 'treinamento' | 'outro';
export type PlaybookTipoConteudo = 'arquivo' | 'link' | 'texto';
export type PlaybookReadStatus = 'nao_lido' | 'lido' | 'confirmado';

export interface PlaybookDoc {
  id: string;
  role: PlaybookRole;
  titulo: string;
  descricao: string | null;
  tipo_conteudo: PlaybookTipoConteudo;
  storage_url: string | null;
  storage_path: string | null;
  link_url: string | null;
  conteudo_rico: string | null;
  obrigatorio: boolean;
  categoria: PlaybookCategoria;
  versao: string;
  data_publicacao: string;
  criado_por: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaybookRead {
  id: string;
  playbook_doc_id: string;
  user_id: string;
  status: PlaybookReadStatus;
  lido_em: string | null;
  confirmado_em: string | null;
  ultima_acao_em: string;
  created_at: string;
  updated_at: string;
}

export interface PlaybookDocWithRead extends PlaybookDoc {
  read_status?: PlaybookReadStatus;
  lido_em?: string | null;
  confirmado_em?: string | null;
}

export const PLAYBOOK_ROLE_LABELS: Record<PlaybookRole, string> = {
  sdr: 'SDR',
  closer: 'Closer',
  coordenador: 'Coordenador',
  gestor_sdr: 'Gestor SDR',
  gestor_closer: 'Gestor Closer',
  master: 'Master',
  admin: 'Admin',
  manager: 'Manager',
  viewer: 'Viewer',
};

export const PLAYBOOK_ROLES_LIST: PlaybookRole[] = [
  'sdr', 'closer', 'coordenador', 'gestor_sdr', 'gestor_closer', 'master', 'admin', 'manager', 'viewer'
];

export const PLAYBOOK_CATEGORIA_LABELS: Record<PlaybookCategoria, string> = {
  onboarding: 'Onboarding',
  processo: 'Processo',
  politica: 'Política',
  script: 'Script',
  treinamento: 'Treinamento',
  outro: 'Outro',
};

export const PLAYBOOK_CATEGORIAS_LIST: PlaybookCategoria[] = [
  'onboarding', 'processo', 'politica', 'script', 'treinamento', 'outro'
];

export const PLAYBOOK_TIPO_LABELS: Record<PlaybookTipoConteudo, string> = {
  arquivo: 'Arquivo',
  link: 'Link',
  texto: 'Texto',
};

export const PLAYBOOK_STATUS_LABELS: Record<PlaybookReadStatus, string> = {
  nao_lido: 'Não lido',
  lido: 'Lido',
  confirmado: 'Confirmado',
};

export const PLAYBOOK_STATUS_COLORS: Record<PlaybookReadStatus, string> = {
  nao_lido: 'bg-muted text-muted-foreground',
  lido: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  confirmado: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};
