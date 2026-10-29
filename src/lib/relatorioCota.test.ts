import assert from 'node:assert/strict';
import { mesAtualSP, mesesHistoricos, mesSemRegistro, rotuloTipoLance, type MesRelatorio } from './relatorioCota';

const m = (mes: string, extra: Partial<MesRelatorio> = {}): MesRelatorio => ({ mes, assembleia: null, loteria: null, lances: [], resultados: [], ...extra });

// Mês de São Paulo na virada do mês
assert.equal(mesAtualSP(new Date('2026-11-01T02:00:00Z')), '2026-10');
// Meses futuros não entram
assert.deepEqual(mesesHistoricos([m('2026-11'), m('2026-10'), m('2026-09')], '2026-10').map((x) => x.mes), ['2026-10', '2026-09']);
// Só assembleia = sem registro
assert.equal(mesSemRegistro(m('2026-04', { assembleia: { numero: 5, data: '2026-04-24', sorteio: null } })), true);
assert.equal(mesSemRegistro(m('2026-10', { loteria: { numero: '4459', aplicado: '4459', consultado_em: '2026-10-22' } })), false);
// Lance antigo sem tipo
assert.equal(rotuloTipoLance(null), 'Tipo não informado');
assert.equal(rotuloTipoLance('embutido'), 'Lance embutido');
console.log('relatorioCota ok');
