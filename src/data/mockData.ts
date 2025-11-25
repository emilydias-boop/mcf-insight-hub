export type KPI = {
  id: string;
  title: string;
  value: string;
  change: number;
  variant: 'success' | 'danger';
};

export type Transacao = {
  id: string;
  data: string;
  descricao: string;
  canal: string;
  valor: number;
  status: 'pago' | 'pendente';
};

export type Despesa = {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
  tipo: 'fixo' | 'variável';
};

export type FunilEtapa = {
  etapa: string;
  leads: number;
  conversao: number;
  meta: number;
};

export type Projeto = {
  id: string;
  nome: string;
  status: 'a-fazer' | 'em-andamento' | 'concluido';
  progresso: number;
  prazo: string;
  responsavel: string;
};

export type ClienteCredito = {
  id: string;
  nome: string;
  cpf: string;
  valorDevido: number;
  diasAtraso: number;
  score: number;
};

export type Leilao = {
  id: string;
  imovel: string;
  endereco: string;
  valorInicial: number;
  lanceAtual: number;
  tempoRestante: string;
  status: 'ativo' | 'arrematado';
};

export type Alerta = {
  id: string;
  tipo: 'critico' | 'aviso' | 'info';
  titulo: string;
  descricao: string;
  data: string;
  resolvido: boolean;
};

export type SemanaMes = {
  dataInicio: string;
  dataFim: string;
  faturamentoA010: number;
  vendasA010: number;
  valorVendidoOBEvento: number;
  vendasOBEvento: number;
  faturamentoContrato: number;
  vendasContratos: number;
  faturamentoOBConstruir: number;
  vendasOBConstruir: number;
  faturamentoOBVitalicio: number;
  vendasOBVitalicio: number;
  totalRevenue?: number;
  totalCost?: number;
  operatingProfit?: number;
  realCost?: number;
  cir?: number;
};

export type Ultrameta = {
  ultrametaClint: number;
  faturamentoIncorporador50k: number;
  faturamentoClintBruto: number;
  ultrametaLiquido: number;
};

export const MOCK_KPIS: KPI[] = [
  { id: '1', title: 'Faturamento Total', value: 'R$ 180.000,00', change: 12.5, variant: 'success' },
  { id: '2', title: 'Custo Total', value: 'R$ 120.000,00', change: 8.2, variant: 'danger' },
  { id: '3', title: 'Lucro Operacional', value: 'R$ 60.000,00', change: 15.3, variant: 'success' },
  { id: '4', title: 'ROI %', value: '50%', change: 5.0, variant: 'success' },
  { id: '5', title: 'ROAS médio', value: '3.5x', change: -2.1, variant: 'danger' },
  { id: '6', title: 'Custo ADS', value: 'R$ 25.000,00', change: 10.0, variant: 'danger' },
  { id: '7', title: 'ROAS Clint', value: '4.2x', change: 8.5, variant: 'success' },
  { id: '8', title: 'CIR médio %', value: '4.2%', change: -1.2, variant: 'success' },
];

export const MOCK_RECEITAS: Transacao[] = [
  { id: '1', data: '2024-01-15', descricao: 'Venda Edifício Solar', canal: 'A010', valor: 8500, status: 'pago' },
  { id: '2', data: '2024-01-16', descricao: 'Proposta Residencial Green', canal: 'Instagram', valor: 3200, status: 'pago' },
  { id: '3', data: '2024-01-17', descricao: 'Contrato Torre MCF', canal: 'Contratos', valor: 12000, status: 'pendente' },
  { id: '4', data: '2024-01-18', descricao: 'Inscrição OB Evento', canal: 'OB Evento', valor: 1500, status: 'pago' },
  { id: '5', data: '2024-01-19', descricao: 'Curso Construir p/ Alugar', canal: 'OB Construir', valor: 900, status: 'pago' },
  { id: '6', data: '2024-01-20', descricao: 'Assinatura Vitalício', canal: 'OB Vitalício', valor: 480, status: 'pago' },
  { id: '7', data: '2024-01-21', descricao: 'Venda Vista Mar', canal: 'A010', valor: 7200, status: 'pago' },
  { id: '8', data: '2024-01-22', descricao: 'Lead Instagram Convertido', canal: 'Instagram', valor: 2800, status: 'pendente' },
  { id: '9', data: '2024-01-23', descricao: 'Parceria Construtora XYZ', canal: 'Contratos', valor: 15000, status: 'pago' },
  { id: '10', data: '2024-01-24', descricao: 'Evento Presencial', canal: 'OB Evento', valor: 2000, status: 'pago' },
];

export const MOCK_CUSTOS: Despesa[] = [
  { id: '1', data: '2024-01-15', descricao: 'Anúncios Facebook', categoria: 'Marketing', valor: 8000, tipo: 'variável' },
  { id: '2', data: '2024-01-16', descricao: 'Salários Equipe', categoria: 'Pessoal', valor: 35000, tipo: 'fixo' },
  { id: '3', data: '2024-01-17', descricao: 'Aluguel Escritório', categoria: 'Administrativo', valor: 5000, tipo: 'fixo' },
  { id: '4', data: '2024-01-18', descricao: 'Google Ads', categoria: 'Marketing', valor: 12000, tipo: 'variável' },
  { id: '5', data: '2024-01-19', descricao: 'Material Construção', categoria: 'Operacional', valor: 18000, tipo: 'variável' },
  { id: '6', data: '2024-01-20', descricao: 'Software e Licenças', categoria: 'Administrativo', valor: 2500, tipo: 'fixo' },
  { id: '7', data: '2024-01-21', descricao: 'Instagram Ads', categoria: 'Marketing', valor: 15000, tipo: 'variável' },
  { id: '8', data: '2024-01-22', descricao: 'Comissões Vendedores', categoria: 'Pessoal', valor: 7000, tipo: 'variável' },
  { id: '9', data: '2024-01-23', descricao: 'Consultorias', categoria: 'Operacional', valor: 4500, tipo: 'variável' },
  { id: '10', data: '2024-01-24', descricao: 'Água, Luz e Internet', categoria: 'Administrativo', valor: 1800, tipo: 'fixo' },
];

export const MOCK_FUNIL_A010: FunilEtapa[] = [
  { etapa: 'Etapa 01 — Novo Lead', leads: 35, conversao: 10.5, meta: 10 },
  { etapa: 'Etapa 03 — R1 Agendada', leads: 57, conversao: 29.7, meta: 30 },
  { etapa: 'Etapa 04 — R1 Realizada', leads: 21, conversao: 10.9, meta: 15 },
  { etapa: 'Etapa 05 — Contrato Pago', leads: 15, conversao: 7.8, meta: 10 },
];

export const MOCK_FUNIL_INSTAGRAM: FunilEtapa[] = [
  { etapa: 'Etapa 01 — Engajamento', leads: 120, conversao: 8.5, meta: 10 },
  { etapa: 'Etapa 02 — Interesse', leads: 48, conversao: 40.0, meta: 35 },
  { etapa: 'Etapa 03 — Qualificado', leads: 28, conversao: 58.3, meta: 50 },
  { etapa: 'Etapa 04 — Convertido', leads: 12, conversao: 42.9, meta: 40 },
];

export const MOCK_PROJETOS: Projeto[] = [
  { id: '1', nome: 'Edifício Solar', status: 'em-andamento', progresso: 65, prazo: '2024-06-30', responsavel: 'João Silva' },
  { id: '2', nome: 'Residencial Green', status: 'a-fazer', progresso: 0, prazo: '2024-08-15', responsavel: 'Maria Santos' },
  { id: '3', nome: 'Torre MCF', status: 'concluido', progresso: 100, prazo: '2024-01-20', responsavel: 'Pedro Costa' },
  { id: '4', nome: 'Condomínio Vista Mar', status: 'em-andamento', progresso: 45, prazo: '2024-09-30', responsavel: 'Ana Paula' },
  { id: '5', nome: 'Edifício Comercial Central', status: 'a-fazer', progresso: 0, prazo: '2024-12-31', responsavel: 'Carlos Eduardo' },
];

export const MOCK_CLIENTES_CREDITO: ClienteCredito[] = [
  { id: '1', nome: 'Roberto Almeida', cpf: '123.456.789-00', valorDevido: 45000, diasAtraso: 15, score: 720 },
  { id: '2', nome: 'Fernanda Souza', cpf: '987.654.321-00', valorDevido: 32000, diasAtraso: 5, score: 680 },
  { id: '3', nome: 'Lucas Oliveira', cpf: '456.789.123-00', valorDevido: 78000, diasAtraso: 30, score: 650 },
  { id: '4', nome: 'Patricia Lima', cpf: '321.654.987-00', valorDevido: 25000, diasAtraso: 0, score: 750 },
];

export const MOCK_LEILOES: Leilao[] = [
  { id: '1', imovel: 'Apartamento 3 quartos', endereco: 'Rua das Flores, 123', valorInicial: 320000, lanceAtual: 340000, tempoRestante: '2d 5h', status: 'ativo' },
  { id: '2', imovel: 'Casa em condomínio', endereco: 'Av. Principal, 456', valorInicial: 650000, lanceAtual: 710000, tempoRestante: '1d 12h', status: 'ativo' },
  { id: '3', imovel: 'Sala comercial', endereco: 'Rua Comercial, 789', valorInicial: 180000, lanceAtual: 195000, tempoRestante: '3d 8h', status: 'ativo' },
  { id: '4', imovel: 'Cobertura duplex', endereco: 'Av. Beira Mar, 321', valorInicial: 850000, lanceAtual: 920000, tempoRestante: '4d 2h', status: 'ativo' },
];

export const MOCK_ALERTAS: Alerta[] = [
  { id: '1', tipo: 'critico', titulo: 'Meta A010 não atingida', descricao: 'Etapa 03 em 55% (meta: 60%)', data: '2024-01-24T10:30:00', resolvido: false },
  { id: '2', tipo: 'aviso', titulo: 'Custo de marketing elevado', descricao: 'Aumento de 40% vs mês anterior', data: '2024-01-24T09:15:00', resolvido: false },
  { id: '3', tipo: 'critico', titulo: 'CIR acima da meta', descricao: 'CIR atual: 5.8% (meta: <5%)', data: '2024-01-24T08:00:00', resolvido: false },
  { id: '4', tipo: 'info', titulo: 'Novo projeto iniciado', descricao: 'Edifício Solar em andamento', data: '2024-01-23T14:20:00', resolvido: false },
  { id: '5', tipo: 'aviso', titulo: 'ROAS Instagram baixo', descricao: 'ROAS: 2.8x (meta: 3.0x)', data: '2024-01-23T11:45:00', resolvido: false },
];

export const MOCK_CANAIS_RECEITA = [
  { canal: 'A010', receita: 67320, percentual: 37.4, ticketMedio: 4200, transacoes: 16 },
  { canal: 'Instagram', receita: 40140, percentual: 22.3, ticketMedio: 2800, transacoes: 14 },
  { canal: 'Contratos', receita: 37980, percentual: 21.1, ticketMedio: 6300, transacoes: 6 },
  { canal: 'OB Evento', receita: 18000, percentual: 10.0, ticketMedio: 1500, transacoes: 12 },
  { canal: 'OB Construir', receita: 10800, percentual: 6.0, ticketMedio: 900, transacoes: 12 },
  { canal: 'OB Vitalício', receita: 5760, percentual: 3.2, ticketMedio: 480, transacoes: 12 },
];

export const MOCK_CATEGORIAS_CUSTO = [
  { categoria: 'Marketing', valor: 48000, percentual: 40, tipo: 'variável' },
  { categoria: 'Pessoal', valor: 42000, percentual: 35, tipo: 'misto' },
  { categoria: 'Operacional', valor: 18000, percentual: 15, tipo: 'variável' },
  { categoria: 'Administrativo', valor: 12000, percentual: 10, tipo: 'fixo' },
];

export const MOCK_SEMANAS = [
  { semana: 'Semana 1', a010: 15000, contratos: 8000, custos: 28000, lucro: -5000, roi: -17.9 },
  { semana: 'Semana 2', a010: 18000, contratos: 12000, custos: 30000, lucro: 0, roi: 0 },
  { semana: 'Semana 3', a010: 16500, contratos: 9500, custos: 31000, lucro: -5000, roi: -16.1 },
  { semana: 'Semana 4', a010: 17820, contratos: 8480, custos: 31000, lucro: -4700, roi: -15.2 },
];

export const MOCK_SEMANAS_DETALHADO: SemanaMes[] = [
  {
    dataInicio: '01/01/2025',
    dataFim: '07/01/2025',
    faturamentoA010: 125000,
    vendasA010: 15,
    valorVendidoOBEvento: 45000,
    vendasOBEvento: 30,
    faturamentoContrato: 85000,
    vendasContratos: 8,
    faturamentoOBConstruir: 32000,
    vendasOBConstruir: 20,
    faturamentoOBVitalicio: 18000,
    vendasOBVitalicio: 12,
  },
  {
    dataInicio: '08/01/2025',
    dataFim: '14/01/2025',
    faturamentoA010: 142000,
    vendasA010: 18,
    valorVendidoOBEvento: 52000,
    vendasOBEvento: 35,
    faturamentoContrato: 95000,
    vendasContratos: 10,
    faturamentoOBConstruir: 38000,
    vendasOBConstruir: 25,
    faturamentoOBVitalicio: 22000,
    vendasOBVitalicio: 15,
  },
  {
    dataInicio: '15/01/2025',
    dataFim: '21/01/2025',
    faturamentoA010: 138000,
    vendasA010: 17,
    valorVendidoOBEvento: 48000,
    vendasOBEvento: 32,
    faturamentoContrato: 92000,
    vendasContratos: 9,
    faturamentoOBConstruir: 35000,
    vendasOBConstruir: 22,
    faturamentoOBVitalicio: 20000,
    vendasOBVitalicio: 14,
  },
  {
    dataInicio: '22/01/2025',
    dataFim: '28/01/2025',
    faturamentoA010: 155000,
    vendasA010: 20,
    valorVendidoOBEvento: 58000,
    vendasOBEvento: 38,
    faturamentoContrato: 105000,
    vendasContratos: 12,
    faturamentoOBConstruir: 42000,
    vendasOBConstruir: 28,
    faturamentoOBVitalicio: 25000,
    vendasOBVitalicio: 18,
  },
  {
    dataInicio: '29/01/2025',
    dataFim: '31/01/2025',
    faturamentoA010: 95000,
    vendasA010: 12,
    valorVendidoOBEvento: 35000,
    vendasOBEvento: 22,
    faturamentoContrato: 68000,
    vendasContratos: 7,
    faturamentoOBConstruir: 25000,
    vendasOBConstruir: 16,
    faturamentoOBVitalicio: 15000,
    vendasOBVitalicio: 10,
  },
];

export const MOCK_ULTRAMETA: Ultrameta = {
  ultrametaClint: 6081715.41,
  faturamentoIncorporador50k: 10526.41,
  faturamentoClintBruto: 6081715.41,
  ultrametaLiquido: 5097044144.45,
};
