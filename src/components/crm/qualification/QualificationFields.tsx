// Campos de qualificação do SDR - Configuração centralizada

export interface QualificationField {
  key: string;
  label: string;
  type: 'select' | 'text' | 'boolean';
  options?: string[];
  required?: boolean;
  showIf?: string; // Campo condicional
  icon?: string;
}

// Profissões populares
export const PROFISSAO_OPTIONS = [
  'Engenheiro(a)',
  'Arquiteto(a)',
  'Médico(a)',
  'Advogado(a)',
  'Empresário(a)',
  'Autônomo(a)',
  'Funcionário Público',
  'Comerciante',
  'Corretor(a)',
  'Vendedor(a)',
  'Professor(a)',
  'Bancário(a)',
  'Militar',
  'Aposentado(a)',
  'Outro',
];

// Estados brasileiros
export const ESTADO_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

// Campos de qualificação - ordem de exibição
export const QUALIFICATION_FIELDS: QualificationField[] = [
  {
    key: 'profissao',
    label: 'Profissão',
    type: 'select',
    options: PROFISSAO_OPTIONS,
    required: true,
    icon: '👤',
  },
  {
    key: 'tem_socio',
    label: 'Tem sócio?',
    type: 'boolean',
    required: false,
    icon: '🤝',
  },
  {
    key: 'nome_socio',
    label: 'Nome do sócio',
    type: 'text',
    required: false,
    showIf: 'tem_socio',
  },
  {
    key: 'estado',
    label: 'Estado',
    type: 'select',
    options: ESTADO_OPTIONS,
    required: true,
    icon: '📍',
  },
  {
    key: 'renda',
    label: 'Faixa de Renda',
    type: 'select',
    options: [
      'Até R$ 5.000',
      'R$ 5.000 a R$ 10.000',
      'R$ 10.000 a R$ 20.000',
      'R$ 20.000 a R$ 30.000',
      '+R$ 30.000',
    ],
    required: true,
    icon: '💰',
  },
  {
    key: 'empreende',
    label: 'Já empreende?',
    type: 'select',
    options: [
      'Sim, já construiu',
      'Sim, outro ramo',
      'Não, mas quer começar',
      'Não',
    ],
    required: true,
    icon: '🏗️',
  },
  {
    key: 'terreno',
    label: 'Possui terreno?',
    type: 'select',
    options: [
      'Sim',
      'Não, mas pretende comprar',
      'Não e não pretende',
      'Não informou',
    ],
    required: true,
    icon: '🏡',
  },
  {
    key: 'investimento',
    label: 'Quanto pretende investir?',
    type: 'select',
    options: [
      'Sem investimento',
      'Até R$ 50.000',
      'R$ 50.000 a R$ 100.000',
      'R$ 100.000 a R$ 200.000',
      '+R$ 200.000',
    ],
    required: true,
    icon: '💵',
  },
  {
    key: 'solucao',
    label: 'Solução que busca',
    type: 'text',
    required: false,
    icon: '🎯',
  },
];

// Tipo para os dados de qualificação
export interface QualificationDataType {
  profissao?: string;
  tem_socio?: boolean;
  nome_socio?: string;
  estado?: string;
  renda?: string;
  empreende?: string;
  terreno?: string;
  investimento?: string;
  solucao?: string;
  [key: string]: string | boolean | undefined;
}

// Gerar resumo formatado no estilo do SDR
export function generateQualificationSummary(
  data: QualificationDataType,
  sdrName?: string
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  const lines: string[] = [];
  
  lines.push(`📋 QUALIFICAÇÃO - ${dateStr} às ${timeStr}`);
  if (sdrName) lines.push(`Por: ${sdrName}`);
  lines.push('');
  
  if (data.profissao) lines.push(`👤 Profissão: ${data.profissao}`);
  if (data.tem_socio) {
    lines.push(`🤝 Sócio: Sim${data.nome_socio ? ` (${data.nome_socio})` : ''}`);
  }
  if (data.estado) lines.push(`📍 Estado: ${data.estado}`);
  if (data.renda) lines.push(`💰 Renda: ${data.renda}`);
  if (data.empreende) lines.push(`🏗️ Experiência: ${data.empreende}`);
  if (data.terreno) lines.push(`🏡 Terreno: ${data.terreno}`);
  if (data.investimento) lines.push(`💵 Investimento: ${data.investimento}`);
  if (data.solucao) lines.push(`🎯 Busca: ${data.solucao}`);
  
  lines.push('');
  lines.push('---');
  
  // Análise do perfil
  const isHighProfile = 
    (data.renda?.includes('20.000') || data.renda?.includes('+R$')) &&
    (data.empreende?.includes('construiu') || data.investimento?.includes('200.000'));
  
  if (isHighProfile) {
    lines.push('✅ Lead qualificado para R1. Perfil alto, boa capacidade de investimento.');
  } else {
    lines.push('📝 Lead qualificado para R1.');
  }
  
  return lines.join('\n');
}

// Gerar resumo compacto para exibição inline
export function generateCompactSummary(data: QualificationDataType): string {
  const parts: string[] = [];
  
  if (data.profissao) parts.push(data.profissao);
  if (data.estado) parts.push(data.estado);
  if (data.renda) parts.push(data.renda);
  if (data.terreno === 'Sim') parts.push('Tem terreno');
  if (data.empreende?.includes('construiu')) parts.push('Já construiu');
  
  return parts.join(' • ');
}
