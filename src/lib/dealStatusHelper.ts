export type DealStatus = 'open' | 'won' | 'lost';

const LOST_KEYWORDS = [
  'perdido', 'perdida', 'desistente', 'desistência', 
  'reembolso', 'reembolsado', 'cancelado', 'cancelada',
  'sem interesse', 'reprovado', 'reprovada', 'não qualificado'
];

const WON_KEYWORDS = [
  'venda realizada', 'contrato pago', 'pagamento concluído',
  'crédito contratado', 'crédito aprovado', 'consórcio fechado',
  'fechado', 'fechada', 'ganho', 'ganha', 'convertido', 'convertida'
];

export const getDealStatusFromStage = (stageName: string | null | undefined): DealStatus => {
  if (!stageName) return 'open';
  
  const lowerStage = stageName.toLowerCase().trim();
  
  // Verificar se é perdido
  if (LOST_KEYWORDS.some(keyword => lowerStage.includes(keyword))) {
    return 'lost';
  }
  
  // Verificar se é ganho
  if (WON_KEYWORDS.some(keyword => lowerStage.includes(keyword))) {
    return 'won';
  }
  
  // Default: aberto
  return 'open';
};

export const getDealStatusLabel = (status: DealStatus): string => {
  switch (status) {
    case 'won': return 'Ganho';
    case 'lost': return 'Perdido';
    case 'open': return 'Aberto';
  }
};

export const getDealStatusColor = (status: DealStatus): string => {
  switch (status) {
    case 'won': return 'text-green-500';
    case 'lost': return 'text-red-500';
    case 'open': return 'text-blue-500';
  }
};
