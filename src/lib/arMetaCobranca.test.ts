import { describe, it, expect } from 'vitest';
import { batimentoPorCobrador, type ParcelaCalc, type TituloCalc } from './arCobrancaCalc';

const p = (o: Partial<ParcelaCalc>): ParcelaCalc => ({ id: Math.random().toString(), titulo_id: 't1', numero: 1, valor: 1000, valor_pago: 1000, status: 'pago', data_vencimento: '2026-11-01', data_pagamento: '2026-11-05', ...o });
const tm = new Map<string, TituloCalc>([['t1', { id: 't1', status: 'aberto', cobranca_responsavel_id: 'b' }]]);

describe('meta mensal de cobrança', () => {
  it('meta geral de 250 mil dividida igualmente entre cobradores', () => {
    const r = batimentoPorCobrador('2026-11', [], tm, [{ cobrador_id: null, valor: 250000 }], ['a', 'b']);
    expect(r.geral.meta).toBe(250000);
    expect(r.porCobrador.map((c) => c.meta)).toEqual([125000, 125000]);
  });
  it('soma só pagamentos do mês, exclui reembolso e atribui ao responsável', () => {
    const r = batimentoPorCobrador('2026-11', [
      p({ cobrador_id: 'a' }), p({}), p({ data_pagamento: '2026-10-30' }), p({ evento: 'reembolso' }),
    ], tm, [{ cobrador_id: null, valor: 250000 }, { cobrador_id: 'a', valor: 2000 }], ['a', 'b']);
    expect(r.geral.realizado).toBe(2000);
    expect(r.porCobrador.find((c) => c.cobrador_id === 'a')).toMatchObject({ meta: 2000, realizado: 1000, pct: 50 });
  });
});
