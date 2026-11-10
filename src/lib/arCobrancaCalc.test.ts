import { strict as assert } from 'node:assert';
import {
  emAberto, inicioSemana, isPendenciaMesAnterior, totaisPorSemana, statusCliente,
  telefoneDigitos, SALDO_ALTO_LIMITE, type ParcelaCalc,
} from './arCobrancaCalc';

const p = (o: Partial<ParcelaCalc>): ParcelaCalc => ({
  id: 'x', titulo_id: 't', numero: 1, valor: 500, valor_pago: null, status: 'pendente',
  data_vencimento: '2026-10-10', data_pagamento: null, ...o,
});

{ const _n = 'semana começa na segunda'; (() => {
    assert.equal(inicioSemana('2026-11-09'), '2026-11-09');
    assert.equal(inicioSemana('2026-11-15'), '2026-11-09');
  })(); }
{ const _n = 'pagamento parcial mostra só o em aberto'; (() => {
    assert.equal(emAberto(p({ valor: 500, valor_pago: 200 })), 300);
  })(); }
{ const _n = 'semanas sem parcelas aparecem com zero'; (() => {
    const r = totaisPorSemana([p({ data_vencimento: '2026-11-03' })], '2026-11-02', '2026-11-22');
    assert.equal(r.length, 3);
    assert.equal(r[0].aReceber, 500);
    assert.equal(r[1].previsto, 0);
    assert.equal(r[2].previsto, 0);
  })(); }
{ const _n = 'cancelada fica fora dos totais'; (() => {
    const r = totaisPorSemana([p({ status: 'cancelado', data_vencimento: '2026-11-03' })], '2026-11-02', '2026-11-08');
    assert.equal(r[0].previsto, 0);
  })(); }
{ const _n = 'pendência só de mês anterior com valor em aberto'; (() => {
    assert.equal(isPendenciaMesAnterior(p({ data_vencimento: '2026-10-31' }), '2026-11-09'), true);
    assert.equal(isPendenciaMesAnterior(p({ data_vencimento: '2026-11-01' }), '2026-11-09'), false);
    assert.equal(isPendenciaMesAnterior(p({ data_vencimento: '2026-10-01', status: 'pago' }), '2026-11-09'), false);
  })(); }
{ const _n = 'judicial tem prioridade sobre atraso'; (() => {
    assert.equal(statusCliente({ id: 't', status: 'aberto', cobranca_stage: 'judicial' }, [p({})], '2026-11-09'), 'judicial');
    assert.equal(statusCliente({ id: 't', status: 'aberto' }, [p({})], '2026-11-09'), 'atrasado');
  })(); }
{ const _n = 'limite de saldo alto é R$ 10.000'; (() => {
    assert.equal(SALDO_ALTO_LIMITE, 10000);
  })(); }
{ const _n = 'telefone ganha DDI 55'; (() => {
    assert.equal(telefoneDigitos('(11) 98888-7777'), '5511988887777');
  })(); }
console.log('arCobrancaCalc: ok');
{
  const { saldoDevedor, visivelNaCobrancaRegular } = await import('./arCobrancaCalc');
  assert.equal(saldoDevedor(2000, 500, 1000), 500);
  assert.equal(saldoDevedor(2000, 2000, 500), 0);
  assert.equal(visivelNaCobrancaRegular({ id: 't', status: 'aberto', cobranca_stage: 'judicial' }), false);
  assert.equal(visivelNaCobrancaRegular({ id: 't', status: 'aberto', cobranca_stage: 'atraso' }), true);
  console.log('arCobrancaCalc saldo/jurídico: ok');
}
{
  const { statusListagem } = await import('./arCobrancaCalc');
  assert.equal(statusListagem({ status: 'aberto', negociacao: true, dias_atraso: 30 }), 'negociacao');
  assert.equal(statusListagem({ status: 'aberto', dias_atraso: 5 }), 'atrasado');
  assert.equal(statusListagem({ status: 'aberto', dias_atraso: 0 }), 'em_dia');
  assert.equal(statusListagem({ status: 'quitado', dias_atraso: 5 }), 'quitado');
  console.log('arCobrancaCalc statusListagem: ok');
}
