import { strict as assert } from 'node:assert';
import { estadoContato } from './contatoPosVenda';

const data = '2026-11-05T18:16:00-03:00';
// Nota sem mudança não libera a etiqueta, mesmo com ligação registrada.
assert.deepEqual(estadoContato({ posVendaContatoConfirmado: false, lastContactAttempt: data, totalActivities: 1 }, true), { ultimoToque: null, nuncaContatado: true });
// Mudança sem nota também não libera; estado ausente nunca é confirmação.
assert.equal(estadoContato({ lastTouchAt: data, totalActivities: 1 }, true).nuncaContatado, true);
// Ambas registradas liberam e usam a data do contato confirmada pelo servidor.
assert.deepEqual(estadoContato({ posVendaContatoConfirmado: true, lastTouchAt: data }, true), { ultimoToque: data, nuncaContatado: false });
// Outras pipelines preservam a regra anterior, mesmo recebendo campo Pós-Venda falso.
assert.deepEqual(estadoContato({ posVendaContatoConfirmado: false, lastContactAttempt: data, totalActivities: 1 }, false), { ultimoToque: data, nuncaContatado: false });
assert.equal(estadoContato({ totalActivities: 0 }, false).nuncaContatado, true);
assert.equal(estadoContato(undefined, true).nuncaContatado, false);
console.log('contatoPosVenda: 6 verificações passaram');