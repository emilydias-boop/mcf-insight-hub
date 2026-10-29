import assert from 'node:assert/strict';
import { horariosLivresPosVenda, inicioSlotSP } from './posVendaDisponibilidade';
const horas = ['14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];
const disponibilidade = [1, 2, 3, 4, 5].flatMap((dia_semana) => horas.map((horario) => ({ gerente_id: 'rebeca', dia_semana, horario })));
const agora = new Date('2026-10-29T10:00:00-03:00');
for (const dia of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']) {
  assert.deepEqual(horariosLivresPosVenda(disponibilidade, 'rebeca', dia, [], 60, agora), horas);
}
for (const dia of ['2026-10-31', '2026-11-01']) {
  assert.deepEqual(horariosLivresPosVenda(disponibilidade, 'rebeca', dia, [], 60, agora), []);
}
assert.equal(inicioSlotSP('2026-10-30', '14:30').toISOString(), '2026-10-30T17:30:00.000Z');
assert.deepEqual(horariosLivresPosVenda(disponibilidade, 'william', '2026-10-30', [], 60, agora), []);
const ocupada = { gerente_id: 'rebeca', inicio: '2026-10-30T15:00:00-03:00', duracao_min: 60, status: 'agendada' };
assert.deepEqual(horariosLivresPosVenda(disponibilidade, 'rebeca', '2026-10-30', [ocupada], 60, agora), ['16:00', '16:30', '17:00']);
assert.deepEqual(horariosLivresPosVenda(disponibilidade, 'rebeca', '2026-10-30', [{ ...ocupada, status: 'cancelada' }], 60, agora), horas);
assert.deepEqual(horariosLivresPosVenda(disponibilidade, 'rebeca', '2026-10-29', [], 60, new Date('2026-10-29T15:00:00-03:00')), ['15:30', '16:00', '16:30', '17:00']);
console.log('Disponibilidade Pós-Venda: dias úteis, seis horários, SP, ocupação e isolamento OK');