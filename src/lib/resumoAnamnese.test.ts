import { strict as assert } from 'node:assert';
import { montarResumoAnamnese, normalizarFonteRenda } from './resumoAnamnese';

assert.equal(montarResumoAnamnese(null, null), null);
assert.equal(montarResumoAnamnese({ nome: 'x', renda_bruta: null, objetivos_principais: [] }, null), null);

const r = montarResumoAnamnese({ situacao_credito: 'negativado', possui_divida: true, tentou_financiamento: 'recusado' }, null)!;
assert.deepEqual(r.alertas.map((a) => a.tom), ['vermelho', 'vermelho', 'vermelho']);

const leve = montarResumoAnamnese({ situacao_credito: 'restricao_leve' }, null)!;
assert.deepEqual(leve.alertas, [{ tom: 'ambar', texto: 'Restrição leve no crédito' }]);

const ap = montarResumoAnamnese({ faixa_aporte: 500 }, null)!;
assert.equal(ap.linhas.find((l) => l.rotulo === 'Aporte')?.valor, 'Faixa de R$ 500 mil');

assert.equal(normalizarFonteRenda('Pro labore '), 'Pró-labore');
assert.equal(normalizarFonteRenda('Clt'), 'CLT');
const rd = montarResumoAnamnese({ renda_bruta: 10000, fonte_renda: 'Pro labore ' }, { renda: '15 mil' })!;
assert.equal(rd.linhas[0].valor, 'R$ 10.000 · Pró-labore');
assert.equal(rd.linhas[0].qualificacao, '15 mil');

const ob = montarResumoAnamnese({ objetivos_principais: ['construcao_venda', 'leilao_imobiliario'], renda_passiva_meta: 20000 }, null)!;
assert.equal(ob.linhas.find((l) => l.rotulo === 'Objetivo')?.valor, 'Construir para vender, Leilão de imóveis · meta R$ 20.000');

console.log('resumoAnamnese ok');
