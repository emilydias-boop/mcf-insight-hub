import { strict as assert } from 'node:assert';
import { batimentoPorCobrador, type ParcelaCalc, type TituloCalc } from './arCobrancaCalc';

const p = (o: Partial<ParcelaCalc>): ParcelaCalc => ({ id: Math.random().toString(), titulo_id: 't1', numero: 1, valor: 1000, valor_pago: 1000, status: 'pago', data_vencimento: '2026-11-01', data_pagamento: '2026-11-05', ...o });
const tm = new Map<string, TituloCalc>([['t1', { id: 't1', status: 'aberto', cobranca_responsavel_id: 'b' }]]);

// Meta geral de 250 mil dividida igualmente entre cobradores
const r1 = batimentoPorCobrador('2026-11', [], tm, [{ cobrador_id: null, valor: 250000 }], ['a', 'b']);
assert.equal(r1.geral.meta, 250000);
assert.deepEqual(r1.porCobrador.map((c) => c.meta), [125000, 125000]);

// Só pagamentos do mês, sem reembolso, atribuídos ao responsável
const r2 = batimentoPorCobrador('2026-11', [
  p({ cobrador_id: 'a' }), p({}), p({ data_pagamento: '2026-10-30' }), p({ evento: 'reembolso' }),
], tm, [{ cobrador_id: null, valor: 250000 }, { cobrador_id: 'a', valor: 2000 }], ['a', 'b']);
assert.equal(r2.geral.realizado, 2000);
const a = r2.porCobrador.find((c) => c.cobrador_id === 'a')!;
assert.deepEqual([a.meta, a.realizado, a.pct], [2000, 1000, 50]);
console.log('arMetaCobranca ok');
