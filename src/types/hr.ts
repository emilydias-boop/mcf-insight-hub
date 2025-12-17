export interface Employee {
  id: string;
  user_id: string | null;
  profile_id: string | null;
  
  // Dados pessoais
  nome_completo: string;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  estado_civil: string | null;
  nacionalidade: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email_pessoal: string | null;
  
  // Dados profissionais
  cargo: string | null;
  departamento: string | null;
  data_admissao: string | null;
  data_demissao: string | null;
  tipo_contrato: string | null;
  jornada_trabalho: string | null;
  
  // Remuneração
  salario_base: number;
  nivel: number;
  
  // Dados bancários
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  pix: string | null;
  
  // Status
  status: 'ativo' | 'ferias' | 'afastado' | 'desligado';
  
  // Vínculos
  sdr_id: string | null;
  
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  tipo_documento: string;
  titulo: string;
  descricao: string | null;
  storage_path: string | null;
  storage_url: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'vencido';
  observacao_status: string | null;
  obrigatorio: boolean;
  visivel_colaborador: boolean;
  created_at: string;
  updated_at: string;
  uploaded_by: string | null;
}

export interface EmployeeEvent {
  id: string;
  employee_id: string;
  tipo_evento: string;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export interface EmployeeNote {
  id: string;
  employee_id: string;
  titulo: string | null;
  conteudo: string;
  tipo: 'geral' | 'feedback' | 'advertencia' | 'elogio' | 'meta';
  privada: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export const EMPLOYEE_STATUS_LABELS: Record<Employee['status'], { label: string; color: string }> = {
  ativo: { label: 'Ativo', color: 'bg-green-500' },
  ferias: { label: 'Férias', color: 'bg-blue-500' },
  afastado: { label: 'Afastado', color: 'bg-yellow-500' },
  desligado: { label: 'Desligado', color: 'bg-red-500' },
};

export const NOTE_TYPE_LABELS: Record<EmployeeNote['tipo'], { label: string; color: string }> = {
  geral: { label: 'Geral', color: 'bg-gray-500' },
  feedback: { label: 'Feedback', color: 'bg-blue-500' },
  advertencia: { label: 'Advertência', color: 'bg-red-500' },
  elogio: { label: 'Elogio', color: 'bg-green-500' },
  meta: { label: 'Meta', color: 'bg-purple-500' },
};

export const DOCUMENT_STATUS_LABELS: Record<EmployeeDocument['status'], { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500' },
  aprovado: { label: 'Aprovado', color: 'bg-green-500' },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-500' },
  vencido: { label: 'Vencido', color: 'bg-gray-500' },
};
