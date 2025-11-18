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
  { id: '7', data: '2024-01-21', descricao: 'Comissões Vendas', categoria: 'Pessoal', valor: 8500, tipo: 'variável' },
  { id: '8', data: '2024-01-22', descricao: 'Instagram Ads', categoria: 'Marketing', valor: 5000, tipo: 'variável' },
  { id: '9', data: '2024-01-23', descricao: 'Manutenção Equipamentos', categoria: 'Operacional', valor: 3200, tipo: 'variável' },
  { id: '10', data: '2024-01-24', descricao: 'Consultorias', categoria: 'Administrativo', valor: 4500, tipo: 'fixo' },
];

export const MOCK_FUNIL_A010: FunilEtapa[] = [
  { etapa: 'Etapa 01', leads: 100, conversao: 100, meta: 100 },
  { etapa: 'Etapa 02', leads: 75, conversao: 75, meta: 80 },
  { etapa: 'Etapa 03', leads: 41, conversao: 55, meta: 60 },
  { etapa: 'Etapa 04', leads: 16, conversao: 38, meta: 40 },
  { etapa: 'Etapa 05', leads: 11, conversao: 68, meta: 70 },
];

export const MOCK_FUNIL_INSTAGRAM: FunilEtapa[] = [
  { etapa: 'Etapa 01', leads: 80, conversao: 100, meta: 100 },
  { etapa: 'Etapa 02', leads: 38, conversao: 48, meta: 50 },
  { etapa: 'Etapa 03', leads: 16, conversao: 42, meta: 40 },
  { etapa: 'Etapa 04', leads: 4, conversao: 28, meta: 30 },
  { etapa: 'Etapa 05', leads: 2, conversao: 62, meta: 60 },
];

export const MOCK_PROJETOS: Projeto[] = [
  { id: '1', nome: 'Edifício Solar', status: 'concluido', progresso: 100, prazo: '2024-01-30', responsavel: 'João Silva' },
  { id: '2', nome: 'Residencial Green Park', status: 'em-andamento', progresso: 60, prazo: '2024-03-15', responsavel: 'Maria Santos' },
  { id: '3', nome: 'Condomínio Vista Mar', status: 'em-andamento', progresso: 40, prazo: '2024-04-20', responsavel: 'Pedro Costa' },
  { id: '4', nome: 'Torre Empresarial MCF', status: 'a-fazer', progresso: 0, prazo: '2024-06-01', responsavel: 'Ana Lima' },
  { id: '5', nome: 'Residencial Parque das Flores', status: 'em-andamento', progresso: 25, prazo: '2024-05-10', responsavel: 'Carlos Mendes' },
  { id: '6', nome: 'Edifício Comercial Centro', status: 'concluido', progresso: 100, prazo: '2024-01-15', responsavel: 'Lucia Ferreira' },
  { id: '7', nome: 'Condomínio Jardim Tropical', status: 'em-andamento', progresso: 80, prazo: '2024-02-28', responsavel: 'Roberto Alves' },
  { id: '8', nome: 'Residencial Bela Vista', status: 'a-fazer', progresso: 0, prazo: '2024-07-15', responsavel: 'Fernanda Rocha' },
  { id: '9', nome: 'Torre Residencial Premium', status: 'em-andamento', progresso: 55, prazo: '2024-04-05', responsavel: 'Marcos Oliveira' },
  { id: '10', nome: 'Edifício Smart Office', status: 'concluido', progresso: 100, prazo: '2024-01-20', responsavel: 'Paula Cardoso' },
];

export const MOCK_CLIENTES_CREDITO: ClienteCredito[] = [
  { id: '1', nome: 'Carlos Silva', cpf: '123.456.789-00', valorDevido: 15000, diasAtraso: 45, score: 620 },
  { id: '2', nome: 'Maria Oliveira', cpf: '234.567.890-11', valorDevido: 8500, diasAtraso: 30, score: 680 },
  { id: '3', nome: 'João Santos', cpf: '345.678.901-22', valorDevido: 22000, diasAtraso: 60, score: 550 },
  { id: '4', nome: 'Ana Costa', cpf: '456.789.012-33', valorDevido: 5000, diasAtraso: 15, score: 720 },
  { id: '5', nome: 'Pedro Lima', cpf: '567.890.123-44', valorDevido: 12000, diasAtraso: 50, score: 590 },
];

export const MOCK_LEILOES: Leilao[] = [
  { id: '1', imovel: 'Apartamento 3 quartos', endereco: 'Rua das Flores, 123', valorInicial: 250000, lanceAtual: 280000, tempoRestante: '2d 5h', status: 'ativo' },
  { id: '2', imovel: 'Casa em condomínio', endereco: 'Av. Central, 456', valorInicial: 450000, lanceAtual: 480000, tempoRestante: '1d 12h', status: 'ativo' },
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
