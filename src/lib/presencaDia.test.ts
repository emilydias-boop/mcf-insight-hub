import assert from 'node:assert/strict';
import { deveMostrarAviso, previaCapacidade, hojeSP, type PessoaPresenca } from './presencaDia';

const p = (o: Partial<PessoaPresenca>): PessoaPresenca => ({
  tipo: 'closer', pessoa_id: 'x', profile_id: 'x', nome: 'X', papel: 'closer_r1', meta: null,
  primeiro_acesso: null, presente_login: true, presente: true, origem: 'login', motivo: null, conta: true, regra: null, ...o,
});

// Incorporador: 6 reuniões × 3 leads por closer presente
const inc = previaCapacidade([p({}), p({}), p({ presente: false }), p({ conta: false })], 6, 3);
assert.equal(inc.closers, 2);
assert.equal(inc.reunioes, 12);
assert.equal(inc.leads, 36);

// Consórcio: 7 reuniões × 1 lead
assert.equal(previaCapacidade([p({})], 7, 1).leads, 7);

// SDR: soma das metas dos presentes que contam
const sdr = previaCapacidade([p({ tipo: 'sdr', papel: 'sdr', meta: 10 }), p({ tipo: 'sdr', papel: 'sdr', meta: 5, presente: false }), p({ tipo: 'sdr', papel: 'sdr', meta: 7, conta: false })], 6, 3);
assert.equal(sdr.agendamentos, 10);

// Aviso a partir das 10:45 SP (13:45 UTC), some depois de confirmar
assert.equal(deveMostrarAviso(new Date('2026-10-30T13:44:00Z'), '10:45', false), false);
assert.equal(deveMostrarAviso(new Date('2026-10-30T13:45:00Z'), '10:45', false), true);
assert.equal(deveMostrarAviso(new Date('2026-10-30T15:00:00Z'), '10:45', true), false);

// Dia em São Paulo (02:00 UTC ainda é o dia anterior)
assert.equal(hojeSP(new Date('2026-10-31T02:00:00Z')), '2026-10-30');

console.log('presencaDia ok');
