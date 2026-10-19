import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { calcTicketParceria } from './ticketParceria';

// Exercise the actual summary reducer and gross rules without database writes.
const source = readFileSync('src/components/relatorios/CloserRevenueSummaryTable.tsx', 'utf8');
const compile = (body: string, params: string[]) => new Function(...params,
  ts.transpile(body, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }));
const pricing = readFileSync('src/lib/incorporadorPricing.ts', 'utf8').replace(/^import .*$/m, '').replace(/export /g, '');
const { getDeduplicatedGross, normalizeProductKey } = compile(pricing + '\nreturn { getDeduplicatedGross, normalizeProductKey };', ['getCachedFixedGrossPrice'])(() => -1);
const keySource = source.slice(source.indexOf('export const isP2'), source.indexOf('interface CloserRow')).replace(/export /g, '');
const bodyStart = source.indexOf('    // Venda = cliente');
const bodyEnd = source.indexOf('\n  }, [filteredTxs', bodyStart);
const run = compile(keySource + '\n' + source.slice(bodyStart, bodyEnd), [
  'filteredTxs', 'atribuicaoMap', 'pagamentosMap', 'globalFirstIds', 'modo', 'canalMap', 'sdrNames', 'sdrSituacao',
  'canaisLista', 'mostrarSemVenda', 'donoMap', 'getDeduplicatedGross', 'normalizeProductKey', 'calcTicketParceria', 'calcRecebimento', 'CANAL_DIRETO',
]);
const tx = (id: string, email: string, gross: number, net: number, installment = 1, product = 'A001') => ({
  id, customer_email: email, product_name: product, product_category: 'incorporador',
  product_price: gross, reference_price: gross, net_value: net, installment_number: installment,
});
function summary(txs: any[], mode = 'closer', inactive = false, showEmpty = true) {
  const attrs = new Map(txs.map(t => [t.id, {
    closer_id: 'c1', closer_nome: 'Closer', sdr_profile_id: t.sdr || 's1', is_outside: t.outside || false,
  }]));
  const result = run(txs, attrs, new Map(), new Set(txs.filter(t => t.installment_number === 1).map(t => t.id)), mode,
    new Map(txs.map(t => [t.id, { canal: 'Canal A' }])), new Map([['s1', 'SDR antigo'], ['s2', 'SDR ativo']]),
    new Map([['s1', { ativo: !inactive, motivo: inactive ? 'outra BU' : null }]]), ['Canal A', 'Vazio'], showEmpty,
    new Map(), getDeduplicatedGross, normalizeProductKey, calcTicketParceria, (g: number) => ({ aReceber: g }), 'Direto (sem entrada)');
  return result;
}
const old = tx('old', 'old@x', 14500, 300, 4);
const new1 = tx('new1', 'new@x', 14500, 900);
const new2 = tx('new2', 'new@x', 14500, 500, 2);
for (const mode of ['closer', 'sdr', 'canal']) {
  const r = summary([old, new1, new2], mode).summaryData;
  assert.equal(r.totalVendas, 1, `${mode}: only new sale`);
  assert.equal(r.totalCount, 2, `${mode}: both new-sale payments`);
  assert.equal(r.totalNet, 1400);
  assert.equal(r.totalCarteira, 300);
  assert.equal(r.totalGross, 14500);
  assert.equal(r.totalTicketParceria.liquidoTotal, 1400);
  const only = summary([old], mode, false, false).summaryData;
  assert.equal(only.rows.length, 1, 'portfolio not hidden');
  assert.equal(only.rows[0].carteiraPagamentos, 1);
  assert.equal(only.totalVendas, 0);
}
for (const [id, installment, product] of [['p45', 4, 'A001'], ['p712', 7, 'A009'], ['r001', 2, 'R001'], ['r009', 2, 'R009'], ['second', 2, 'A003']] as const) {
  assert.equal(summary([tx(id, id, 1000, 50, installment, product)]).summaryData.totalCarteira, 50);
}
const p2 = tx('p2', 'p2@x', 5000, 200, 1, 'A005');
const outside = { ...tx('out', 'out@x', 14500, 400, 7), outside: true };
const reconciliation = summary([old, new1, new2, p2, outside]).summaryData;
assert.equal(reconciliation.outsidePagamentos, 1);
assert.equal(reconciliation.outsideLiquido, 400, 'outside with zero gross never becomes portfolio');
assert.equal(reconciliation.p2Liquido, 200);
assert.equal(reconciliation.totalNet + reconciliation.totalCarteira + reconciliation.p2Liquido + reconciliation.outsideLiquido, 2300);
const grouped = summary([old, p2], 'sdr', true);
assert.equal(grouped.summaryData.rows[0].id, '__ex_sdr__');
assert.equal(grouped.summaryData.rows[0].p2Count, 1);
assert.equal(grouped.closerTransactionsMap.get('__ex_sdr__').length, 2);
assert.equal(grouped.summaryData.rows[0].exSdrs[0].motivo, 'outra BU');
for (const periodSale of [new1, outside]) {
  const own = summary([old, periodSale], 'sdr', true).summaryData.rows[0];
  assert.equal(own.id, 's1');
  assert.equal(own.sdrMotivo, 'outra BU');
}
const ordered = summary([old, { ...new1, sdr: 's2' }], 'sdr').summaryData.rows;
assert.equal(ordered[0].id, 's2');
assert.equal(ordered[1].carteira, 300);
console.log('Faturamento: regras de carteira, vendas novas, ex-SDRs, P2, Outside e conciliação passaram nos 3 modos.');