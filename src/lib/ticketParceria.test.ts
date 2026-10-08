import assert from 'node:assert/strict';
import { calcTicketParceria, isProdutoTicketParceria } from './ticketParceria';

// 1) Só os produtos de parceria, sem renovação.
assert.equal(isProdutoTicketParceria('A001 - Consórcio'), true);
assert.equal(isProdutoTicketParceria(' a003 ', true), true);
assert.equal(isProdutoTicketParceria('R009 - Plano'), true);
assert.equal(isProdutoTicketParceria('A005/P2'), false);
assert.equal(isProdutoTicketParceria('A000'), false);
assert.equal(isProdutoTicketParceria('A010'), false);
assert.equal(isProdutoTicketParceria('Renovação A003'), false);

// 2) Vendas novas com bruto > 0 entram no numerador e no denominador.
const novas = [
  { productName: 'A001', bruto: 1000, liquido: 900 },
  { productName: 'R001', bruto: 3000, liquido: 2700 },
];
const t = calcTicketParceria(novas);
assert.equal(t.vendas, 2);
assert.equal(t.brutoTotal, 4000);
assert.equal(t.liquidoTotal, 3600);
assert.equal(t.ticketBruto, 2000);
assert.equal(t.ticketLiquido, 1800);

// 3) Mensalidade de recorrência (2/12) e parcela de plano anterior: bruto 0, ficam fora.
const comRecorrencia = [
  ...novas,
  { productName: 'A001', bruto: 0, liquido: 500 }, // 2/12 de recorrência
  { productName: 'R009', bruto: 0, liquido: 500 }, // parcela de plano de mês anterior
];
const t2 = calcTicketParceria(comRecorrencia);
assert.equal(t2.vendas, 2);
assert.equal(t2.brutoTotal, 4000);
assert.equal(t2.liquidoTotal, 3600);
assert.equal(t2.ticketBruto, 2000);
assert.equal(t2.ticketLiquido, 1800);

// 4) Reembolso e líquido negativo ficam fora.
const t3 = calcTicketParceria([
  ...novas,
  { productName: 'A003', bruto: 5000, liquido: 4500, refunded: true },
  { productName: 'A009', bruto: 2000, liquido: -200 },
]);
assert.equal(t3.vendas, 2);
assert.equal(t3.liquidoTotal, 3600);

// 5) Sem venda nova: nada de divisão por zero.
const t4 = calcTicketParceria([{ productName: 'A001', bruto: 0, liquido: 500 }]);
assert.equal(t4.vendas, 0);
assert.equal(t4.brutoTotal, 0);
assert.equal(t4.liquidoTotal, 0);
assert.equal(t4.ticketBruto, null);
assert.equal(t4.ticketLiquido, null);

console.log('ticketParceria: ok');
