import { strict as assert } from 'node:assert';
import { batimentoPorCobrador, type ParcelaCalc, type TituloCalc } from './arCobrancaCalc';

const p = (o: Partial<ParcelaCalc>): ParcelaCalc => ({ id: Math.random().toString(), titulo_id: 't1', numero: 2, valor: 1000, valor_pago: 1000, status: 'pago', data_vencimento: '2026-11-01', data_pagamento: '2026-11-05', ...o });
const tm = new Map<string, TituloCalc>([
  ['t1', { id: 't1', status: 'aberto', cobranca_responsavel_id: 'b', payment_method: 'pix' }],
  ['tj', { id: 'tj', status: 'aberto', cobranca_stage: 'judicial' }],
  ['tc', { id: 'tc', status: 'aberto', payment_method: 'credit_card' }],
]);
const meta = [{ cobrador_id: null, valor: 250000 }];

// Meta geral de 250 mil dividida igualmente
const r1 = batimentoPorCobrador('2026-11', [], tm, meta, ['a', 'b']);
assert.equal(r1.geral.meta, 250000);
assert.deepEqual(r1.porCobrador.map((c) => c.meta), [125000, 125000]);

// Integral/entrada (parcela 1), judicial, cartão, reembolso e outro mês não contam; parcela 2 conta
const r2 = batimentoPorCobrador('2026-11', [
  p({ numero: 1 }), p({ titulo_id: 'tj' }), p({ titulo_id: 'tc' }), p({ evento: 'reembolso' }),
  p({ data_pagamento: '2026-10-30', data_vencimento: '2026-10-30' }), p({ cobrador_id: 'a' }), p({}),
], tm, [...meta, { cobrador_id: 'a', valor: 2000 }], ['a', 'b']);
assert.equal(r2.geral.realizado, 2000);
const a = r2.porCobrador.find((c) => c.cobrador_id === 'a')!;
assert.deepEqual([a.meta, a.realizado, a.pct], [2000, 1000, 50]);

// Previsto: vence no mês + atrasada anterior em aberto
const r3 = batimentoPorCobrador('2026-11', [
  p({ status: 'pendente', valor_pago: 0, data_pagamento: null }),
  p({ status: 'atrasado', valor_pago: 0, data_pagamento: null, data_vencimento: '2026-10-10' }),
], tm, meta, ['b']);
assert.equal(r3.geral.previsto, 2000);
assert.equal(r3.geral.realizado, 0);
console.log('arMetaCobranca ok');

import { ritmoMetaCobranca } from './arCobrancaCalc';
// Novembro/2026 tem 21 dias úteis; meta 250 mil → ~11.904,76/dia; semanas seg→dom
const rt = ritmoMetaCobranca('2026-11', '2026-11-11', 210000, { '2026-11-11': 500, '2026-11-03': 100 });
assert.equal(rt.diasUteis, 21);
assert.equal(rt.metaDia, 10000);
assert.equal(rt.esperadoAteHoje, 80000);
assert.equal(rt.realizadoHoje, 500);
assert.equal(rt.semanas[0].inicio, '2026-11-01'); // domingo isolado
assert.equal(rt.semanas[1].inicio, '2026-11-02');
assert.ok(rt.semanas.find((s) => s.isCurrent)!.realizado === 500);
console.log('ritmo ok');
