import { Employee, RhNfse } from './hr';

export interface PagamentoPJ {
  employee: Employee;
  fechamento: {
    id: string;
    ano_mes: string;
    total_conta: number;
    status: string;
  } | null;
  nfse: RhNfse | null;
  diferenca: number | null;
}

export interface PagamentoFilters {
  mes: number;
  ano: number;
  squad?: string;
  cargo?: string;
  statusNfse?: 'todos' | 'pendente_envio' | 'nota_enviada';
  statusPagamento?: 'todos' | 'pendente' | 'pago' | 'em_atraso';
}

export interface ReceitaFilters {
  dataInicial: Date;
  dataFinal: Date;
  produto?: string;
  origem?: string;
}

export interface ReceitaItem {
  id: string;
  sale_date: string;
  product_name: string;
  product_category: string | null;
  customer_name: string | null;
  customer_email: string | null;
  source: string | null;
  product_price: number | null;
  net_value: number | null;
  sale_status: string | null;
}

export interface PagamentosSummary {
  totalAPagar: number;
  nfseEnviadas: number;
  totalFechamentos: number;
  totalPago: number;
  pendente: number;
}

export interface ReceitasSummary {
  faturamentoBruto: number;
  faturamentoLiquido: number;
  numeroContratos: number;
  ticketMedio: number;
}

export const PRODUCT_CATEGORIES = [
  { value: 'a010', label: 'A010' },
  { value: 'a001', label: 'Incorporador 50K' },
  { value: 'ob_vitalicio', label: 'OB Acesso Vitalício' },
  { value: 'ob_construir', label: 'OB Construir Para Alugar' },
  { value: 'ob_evento', label: 'OB Imersão Presencial' },
  { value: 'contrato', label: 'Contratos' },
  { value: 'outros', label: 'Outros' },
];

export const SOURCE_OPTIONS = [
  { value: 'hubla', label: 'Hubla' },
  { value: 'make', label: 'Make' },
  { value: 'kiwify', label: 'Kiwify' },
];
