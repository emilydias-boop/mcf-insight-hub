import { strict as assert } from 'node:assert';
import { montarParcelasCota, qtdParcelasGeradas, type ParamsCronograma } from '../../supabase/functions/_shared/consorcioCronograma';
import { calcularProximoDiaUtil as compartilhado } from '../../supabase/functions/_shared/consorcioDiasUteis';
import { calcularProximoDiaUtil as existente } from './businessDays';

// Consultas simuladas somente em memória: nenhuma geração/baixa no banco.
function bancoTabela(tipo: 'primeira_parcela' | 'dividida_12') {
  const produto = { id: 'produto', codigo: 'TP', ativo: true, taxa_antecipada_tipo: tipo, faixa_credito_min: 0, faixa_credito_max: 2000000 };
  const credito = { parcela_1a_12a_conv_240: 900, parcela_demais_conv_240: 700 };
  return {
    from(tabela: string) {
      const data = tabela === 'consorcio_produtos' ? [produto] : [credito];
      const query: any = {
        select: () => query, eq: () => query, lte: () => query, gte: () => query,
        limit: () => query, maybeSingle: async () => ({ data: data[0], error: null }),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
      };
      return query;
    },
  };
}
const params: ParamsCronograma = { cardId: 'cota', baseDate: '2026-11-20', diaVencimento: 20, prazoMeses: 240, valorCredito: 120000, tipoProduto: 'parcelinha', parcelasEmpresa: 240, inicioSegundaParcela: 'proximo_mes' };

assert.equal(qtdParcelasGeradas(240), 240, 'prazo de 240 gera todas as parcelas');
assert.equal(qtdParcelasGeradas(12), 12);
assert.equal(qtdParcelasGeradas(0), 0);
const parcelas = await montarParcelasCota(params, bancoTabela('dividida_12'));
assert.equal(parcelas.length, 240);
assert.equal(parcelas[239].numero_parcela, 240);
assert.equal(parcelas[11].tipo, 'empresa');
assert.equal(parcelas[12].tipo, 'cliente', 'quantidade nunca deriva MCF após a 12ª');
assert.equal(parcelas[239].tipo, 'cliente');
assert.equal(parcelas[11].valor_parcela, 900);
assert.equal(parcelas[12].valor_parcela, 700, '13ª usa demais da tabela Embracon');
assert.equal(parcelas[11].valor_estimado, false);
assert.equal(parcelas[12].valor_estimado, true);
assert.equal(parcelas[239].valor_estimado, true);
assert.equal(parcelas[12].valor_comissao, 0);

const explicitas = await montarParcelasCota({ ...params, parcelasNumeros: [2, 13, 240] }, bancoTabela('dividida_12'));
assert.deepEqual(explicitas.filter(p => p.tipo === 'empresa').map(p => p.numero_parcela), [2, 13, 240], 'somente números explícitos ultrapassam a 12ª');
const intercaladas = await montarParcelasCota({ ...params, tipoContrato: 'intercalado' }, bancoTabela('dividida_12'));
assert.deepEqual(intercaladas.filter(p => p.tipo === 'empresa').map(p => p.numero_parcela), [2, 4, 6, 8, 10, 12]);
const impares = await montarParcelasCota({ ...params, tipoContrato: 'intercalado_impar' }, bancoTabela('dividida_12'));
assert.deepEqual(impares.filter(p => p.tipo === 'empresa').map(p => p.numero_parcela), [1, 3, 5, 7, 9, 11]);
const reserva = await montarParcelasCota({ ...params, isReserva: true }, bancoTabela('dividida_12'));
assert.equal(reserva.every(p => p.status === 'previsto'), true);
const select = await montarParcelasCota({ ...params, tipoProduto: 'select' }, bancoTabela('primeira_parcela'));
assert.equal(select[0].valor_parcela, 900);
assert.equal(select[1].valor_parcela, 700);

assert.equal(parcelas[0].data_vencimento, '2026-11-20');
assert.equal(parcelas[1].data_vencimento, '2026-12-21');
// O calendário compartilhado preserva as regras de dia útil existentes em todo o prazo.
for (let ano = 2026; ano <= 2046; ano++) for (let mes = 0; mes < 12; mes++) {
  const data = new Date(ano, mes, 20);
  assert.equal(compartilhado(data).getTime(), existente(data).getTime());
}
console.log('consorcioCronograma: prazo integral, tabela, pagador, estimativa e calendário OK');