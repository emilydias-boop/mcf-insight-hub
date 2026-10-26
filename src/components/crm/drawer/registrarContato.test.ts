import { strict as assert } from 'node:assert';
import { presets, rotuloCurto, rotuloLongo, podeRegistrar } from './registrarContato';

// Seg 26/10/2026 10:00 SP → Hoje 17h; Em 3 dias = qui 29/10
let p = presets(new Date('2026-10-26T13:00:00Z'));
assert.equal(p[0].label, 'Hoje 17h');
assert.equal(p[0].iso, '2026-10-26T17:00:00-03:00');
assert.equal(p[1].iso, '2026-10-27T10:00:00-03:00');
assert.equal(p[2].iso, '2026-10-29T10:00:00-03:00');
// 16:50 SP → Hoje +1h arredondado (17:50 → 18:00)
p = presets(new Date('2026-10-26T19:50:00Z'));
assert.equal(p[0].label, 'Hoje +1h');
assert.equal(p[0].iso, '2026-10-26T18:00:00-03:00');
// Qui 29/10 → +3 = dom 01/11 → segunda 02/11
p = presets(new Date('2026-10-29T13:00:00Z'));
assert.equal(p[2].iso, '2026-11-02T10:00:00-03:00');
// Qua 28/10 → +3 = sáb 31/10 → segunda 02/11
p = presets(new Date('2026-10-28T13:00:00Z'));
assert.equal(p[2].iso, '2026-11-02T10:00:00-03:00');
assert.equal(rotuloCurto('2026-10-29T14:30:00-03:00'), 'Qui 29/10 · 14:30');
assert.equal(rotuloLongo('2026-10-29T14:30:00-03:00'), 'quinta, 29/10 às 14:30');
assert.equal(podeRegistrar(null, null), false);
assert.equal(podeRegistrar('atendeu', null), true);
assert.equal(podeRegistrar(null, '2026-10-29T14:30:00-03:00'), true);
console.log('13 assertions passed — registrar contato');
