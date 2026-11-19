import { strict as assert } from 'node:assert';
import { notaEncaminhamentoConsorcio } from './posVendaConsorcioNota';

// Sem trechos: nota vazia, justificativa obrigatória.
assert.equal(notaEncaminhamentoConsorcio([], () => ''), '');
// Com trechos: leva o texto da transcrição.
assert.ok(notaEncaminhamentoConsorcio([{ reuniao_inicio: 'x', trecho: 'quero uma carta de crédito' }], () => '18/11').includes('[18/11] "quero uma carta de crédito"'));
console.log('ok');
