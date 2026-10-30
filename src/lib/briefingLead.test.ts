import { strict as assert } from 'node:assert';
import { rotuloFonte, estiloAtencao, geradoHa, fontesUsadas, type BriefingConteudo } from './briefingLead';

assert.equal(rotuloFonte('qualificacao'), 'SDR');
assert.equal(rotuloFonte('nota_closer'), 'closer');
assert.equal(rotuloFonte('ligacao'), 'ligação');
assert.equal(rotuloFonte('r2'), 'R2');

assert.deepEqual(estiloAtencao('risco'), { icone: '!', tom: 'vermelho' });
assert.deepEqual(estiloAtencao('divergencia'), { icone: '≠', tom: 'ambar' });
assert.deepEqual(estiloAtencao('lacuna'), { icone: '?', tom: 'ambar' });

const agora = new Date('2026-10-30T12:00:00Z');
assert.equal(geradoHa('2026-10-30T11:59:40Z', agora), 'agora');
assert.equal(geradoHa('2026-10-30T11:45:00Z', agora), '15 min');
assert.equal(geradoHa('2026-10-30T09:00:00Z', agora), '3 h');
assert.equal(geradoHa('2026-10-29T10:00:00Z', agora), '1 dia');
assert.equal(geradoHa(null, agora), '');

const c: BriefingConteudo = {
  resumo_curto: '', alerta_curto: '',
  quem_e: [{ rotulo: 'Renda', texto: 'x', fontes: ['anamnese', 'qualificacao'] }],
  como_chegou: [{ texto: 'y', fontes: ['anamnese'] }],
  ja_falado: [], combinado: [],
  atencao: [{ tipo: 'risco', texto: 'z', fontes: ['pagamento'] }],
  perguntas: [],
};
assert.deepEqual(fontesUsadas(c), ['anamnese', 'qualificacao', 'pagamento']);

console.log('briefingLead ok');
