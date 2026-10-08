import { describe, it, expect } from 'vitest';
import { isProdutoTicketParceria, calcTicketParceria } from './ticketParceria';

describe('ticketParceria', () => {
  it('aceita só A001/A003/A009/R001/R009 sem renovação', () => {
    expect(isProdutoTicketParceria(' a003 - Anticrise')).toBe(true);
    expect(isProdutoTicketParceria('R009 x')).toBe(true);
    expect(isProdutoTicketParceria('A001 - Renovação')).toBe(false);
    expect(isProdutoTicketParceria('A005 - P2')).toBe(false);
    expect(isProdutoTicketParceria('A000 - Contrato')).toBe(false);
  });
  it('ignora reembolso e divide bruto só por vendas com bruto', () => {
    const t = calcTicketParceria([
      { productName: 'A001', bruto: 10000, liquido: 9000 },
      { productName: 'A009', bruto: 0, liquido: 1000 },
      { productName: 'A003', bruto: 5000, liquido: 4000, refunded: true },
      { productName: 'A010', bruto: 50, liquido: 40 },
    ]);
    expect(t.vendas).toBe(2);
    expect(t.ticketBruto).toBe(10000);
    expect(t.ticketLiquido).toBe(5000);
  });
  it('sem vendas → null', () => {
    expect(calcTicketParceria([]).ticketBruto).toBeNull();
  });
});
