/** Ticket médio de parceria: só A001, A003, A009, R001, R009 (sem renovação, sem reembolso). */
export const TICKET_PARCERIA_TOOLTIP = 'Só parceria: A001, A003, A009, R001, R009 (sem renovação, sem reembolso)';

const PREFIXOS = ['a001', 'a003', 'a009', 'r001', 'r009'];

export function isProdutoTicketParceria(productName: string | null | undefined): boolean {
  const nome = (productName || '').trim().toLowerCase();
  if (!nome || nome.includes('renova')) return false;
  return PREFIXOS.some((p) => nome.startsWith(p));
}

/** Uma venda já consolidada (uma por vendaKey, bruto/líquido somados). */
export interface VendaTicket {
  productName: string | null | undefined;
  bruto: number;
  liquido: number;
  /** true se algum pagamento da venda tem sale_status 'refunded'. */
  refunded?: boolean;
}

export interface TicketParceria {
  vendas: number;
  brutoTotal: number;
  liquidoTotal: number;
  ticketBruto: number | null;
  ticketLiquido: number | null;
}

export function calcTicketParceria(vendas: VendaTicket[]): TicketParceria {
  const validas = vendas.filter(
    (v) => isProdutoTicketParceria(v.productName) && !v.refunded && v.liquido >= 0,
  );
  const brutoTotal = validas.reduce((s, v) => s + v.bruto, 0);
  const liquidoTotal = validas.reduce((s, v) => s + v.liquido, 0);
  const comBruto = validas.filter((v) => v.bruto > 0).length;
  return {
    vendas: validas.length,
    brutoTotal,
    liquidoTotal,
    ticketBruto: comBruto > 0 ? brutoTotal / comBruto : null,
    ticketLiquido: validas.length > 0 ? liquidoTotal / validas.length : null,
  };
}
