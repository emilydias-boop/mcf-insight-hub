import { strict as assert } from 'node:assert';
import { diasCalendarioDesde, rotuloContato } from './diasCalendario';

// "2026-10-27T15:21:00-03:00" aqui significa 15:21 de SP, montado com offset -03:00.
const sp = (s: string) => new Date(s);

// 27/10 15:21 SP vs 28/10 10:36 SP → 1 (bug reportado: dava 0 em blocos de 24h)
assert.equal(
  diasCalendarioDesde(sp('2026-10-27T15:21:00-03:00'), sp('2026-10-28T10:36:00-03:00')),
  1,
);
// Virada de dia por poucos minutos: 27/10 23:50 SP vs 28/10 00:10 SP → 1
assert.equal(
  diasCalendarioDesde(sp('2026-10-27T23:50:00-03:00'), sp('2026-10-28T00:10:00-03:00')),
  1,
);
// Mesmo dia → 0
assert.equal(
  diasCalendarioDesde(sp('2026-10-28T00:05:00-03:00'), sp('2026-10-28T23:00:00-03:00')),
  0,
);
// 25/10 vs 28/10 → 3
assert.equal(
  diasCalendarioDesde(sp('2026-10-25T20:00:00-03:00'), sp('2026-10-28T10:00:00-03:00')),
  3,
);
// Virada de mês 31/10 → 01/11 → 1
assert.equal(
  diasCalendarioDesde(sp('2026-10-31T22:00:00-03:00'), sp('2026-11-01T08:00:00-03:00')),
  1,
);
// Instante futuro não negativa → 0
assert.equal(
  diasCalendarioDesde(sp('2026-10-29T10:00:00-03:00'), sp('2026-10-28T10:00:00-03:00')),
  0,
);

// Rótulos
assert.equal(rotuloContato(0), 'Contato hoje');
assert.equal(rotuloContato(1), 'Contato ontem');
assert.equal(rotuloContato(2), '2d sem contato');
assert.equal(rotuloContato(15), '15d sem contato');

console.log('diasCalendario: ok');
