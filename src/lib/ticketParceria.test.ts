import { calcTicketParceria, isProdutoTicketParceria } from './ticketParceria';

/** Sem dependência de runner: roda com `bun src/lib/ticketParceria.test.ts` ou `bun test`. */
function eq(actual: unknown, expected: unknown, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}: esperado ${String(expected)}, obtido ${String(actual)}`);
  }
}

// 1) Só os produtos de parceria, sem renovação.
eq(isProdutoTicketParceria('A001 - Consórcio'), true, 'A001 é parceria');
eq(isProdutoTicketParceria(' a003 '), true, 'A003 com espaços é parceria');
eq(isProdutoTicketParceria('R009 - Plano'), true, 'R009 é parceria');
eq(isProdutoTicketParceria('A005/P2'), false, 'A005/P2 não é parceria');
eq(isProdutoTicketParceria('A000'), false, 'A000 não é parceria');
eq(isProdutoTicketParceria('A010'), false, 'A010 não é parceria');
eq(isProdutoTicketParceria('Renovação A003'), false, 'renovação não é parceria');

// 2) Vendas novas com bruto > 0 entram no numerador e no denominador.
const novas = [
  { productName: 'A001', bruto: 1000, liquido: 900 },
  { productName: 'R001', bruto: 3000, liquido: 2700 },
];
const t = calcTicketParceria(novas);
eq(t.vendas, 2, 'vendas');
eq(t.brutoTotal, 4000, 'brutoTotal');
eq(t.liquidoTotal, 3600, 'liquidoTotal');
eq(t.ticketBruto, 2000, 'ticketBruto');
eq(t.ticketLiquido, 1800, 'ticketLiquido');

// 3) Mensalidade de recorrência (2/12) e parcela de plano de mês anterior: bruto 0, ficam fora.
const comRecorrencia = [
  ...novas,
  { productName: 'A001', bruto: 0, liquido: 500 },
  { productName: 'R009', bruto: 0, liquido: 500 },
];
const t2 = calcTicketParceria(comRecorrencia);
eq(t2.vendas, 2, 'vendas ignora bruto 0');
eq(t2.brutoTotal, 4000, 'brutoTotal ignora bruto 0');
eq(t2.liquidoTotal, 3600, 'liquidoTotal ignora bruto 0');
eq(t2.ticketBruto, 2000, 'ticketBruto ignora bruto 0');
eq(t2.ticketLiquido, 1800, 'ticketLiquido ignora bruto 0');

// 4) Reembolso e líquido negativo ficam fora.
const t3 = calcTicketParceria([
  ...novas,
  { productName: 'A003', bruto: 5000, liquido: 4500, refunded: true },
  { productName: 'A009', bruto: 2000, liquido: -200 },
]);
eq(t3.vendas, 2, 'vendas ignora reembolso');
eq(t3.liquidoTotal, 3600, 'liquidoTotal ignora reembolso');

// 5) Sem venda nova: nada de divisão por zero.
const t4 = calcTicketParceria([{ productName: 'A001', bruto: 0, liquido: 500 }]);
eq(t4.vendas, 0, 'vendas sem venda nova');
eq(t4.brutoTotal, 0, 'brutoTotal sem venda nova');
eq(t4.liquidoTotal, 0, 'liquidoTotal sem venda nova');
eq(t4.ticketBruto, null, 'ticketBruto sem venda nova');
eq(t4.ticketLiquido, null, 'ticketLiquido sem venda nova');

console.log('ticketParceria: ok');
