import { describe, expect, test } from 'bun:test';
import {
  emAberto, inicioSemana, isPendenciaMesAnterior, totaisPorSemana, statusCliente,
  telefoneDigitos, SALDO_ALTO_LIMITE, type ParcelaCalc,
} from './arCobrancaCalc';

const p = (o: Partial<ParcelaCalc>): ParcelaCalc => ({
  id: 'x', titulo_id: 't', numero: 1, valor: 500, valor_pago: null, status: 'pendente',
  data_vencimento: '2026-10-10', data_pagamento: null, ...o,
});

describe('cobrança', () => {
  test('semana começa na segunda', () => {
    expect(inicioSemana('2026-11-09')).toBe('2026-11-09');
    expect(inicioSemana('2026-11-15')).toBe('2026-11-09');
  });
  test('pagamento parcial mostra só o em aberto', () => {
    expect(emAberto(p({ valor: 500, valor_pago: 200 }))).toBe(300);
  });
  test('semanas sem parcelas aparecem com zero', () => {
    const r = totaisPorSemana([p({ data_vencimento: '2026-11-03' })], '2026-11-02', '2026-11-22');
    expect(r.length).toBe(3);
    expect(r[0].aReceber).toBe(500);
    expect(r[1].previsto).toBe(0);
    expect(r[2].previsto).toBe(0);
  });
  test('cancelada fica fora dos totais', () => {
    const r = totaisPorSemana([p({ status: 'cancelado', data_vencimento: '2026-11-03' })], '2026-11-02', '2026-11-08');
    expect(r[0].previsto).toBe(0);
  });
  test('pendência só de mês anterior com valor em aberto', () => {
    expect(isPendenciaMesAnterior(p({ data_vencimento: '2026-10-31' }), '2026-11-09')).toBe(true);
    expect(isPendenciaMesAnterior(p({ data_vencimento: '2026-11-01' }), '2026-11-09')).toBe(false);
    expect(isPendenciaMesAnterior(p({ data_vencimento: '2026-10-01', status: 'pago' }), '2026-11-09')).toBe(false);
  });
  test('judicial tem prioridade sobre atraso', () => {
    expect(statusCliente({ id: 't', status: 'aberto', cobranca_stage: 'judicial' }, [p({})], '2026-11-09')).toBe('judicial');
    expect(statusCliente({ id: 't', status: 'aberto' }, [p({})], '2026-11-09')).toBe('atrasado');
  });
  test('limite de saldo alto é R$ 10.000', () => {
    expect(SALDO_ALTO_LIMITE).toBe(10000);
  });
  test('telefone ganha DDI 55', () => {
    expect(telefoneDigitos('(11) 98888-7777')).toBe('5511988887777');
  });
});
