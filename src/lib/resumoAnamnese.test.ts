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

// --- texto corrido do SDR ---
const AGORA = new Date('2026-10-30T15:00:00Z');
const cheio = montarResumoAnamnese(
  {
    profissao: 'Engenheiro Civil',
    data_nascimento: '2003-11-08',
    estado_cidade: 'BA - Capim Grosso',
    renda_bruta: 8000,
    fonte_renda: 'Pró-labore',
    is_empresario: false,
    ja_constroi: 'em_andamento',
    experiencia_imobiliaria: 'profissional',
    objetivos_principais: ['construcao_venda', 'construir_para_cliente'],
    renda_passiva_meta: 30000,
    faixa_aporte: 50,
    urgencia_operacao: '1_3',
  },
  null,
  AGORA,
)!;
assert.equal(
  cheio.texto,
  'Engenheiro Civil, 22 anos, de Capim Grosso (BA). Renda de R$ 8.000 (Pró-labore), não é empresário. Tem obra em andamento, experiência profissional. Quer construir para vender e construir para clientes, com meta de renda passiva de R$ 30.000. Faixa de aporte de R$ 50 mil, quer começar em 1 a 3 meses.',
);

const soRenda = montarResumoAnamnese({ renda_bruta: 12000 }, null, AGORA)!;
assert.equal(soRenda.texto, 'Renda de R$ 12.000.');
assert.equal(soRenda.alertas.length, 0);

const semData = montarResumoAnamnese({ profissao: 'Médico', estado_cidade: 'SP - São Paulo', faixa_aporte: 300 }, null, AGORA)!;
assert.equal(semData.texto, 'Médico, de São Paulo (SP). Faixa de aporte de R$ 300 mil.');

console.log('resumoAnamnese ok');
