import { strict as assert } from 'node:assert';
import { criaCiclo, montarModelo, mapaPais, recolhidosIniciais, visiveis, layoutHierarquico, caminhoAteTopo, type EstruturaRaw } from './estruturaOrg';

const raw: EstruturaRaw = {
  pode_editar: true, meu_employee_id: null,
  setores: [{ id: 'S', nome: 'Diretoria', parent_id: null, responsavel_employee_id: 'p1', ordem: 1 }, { id: 'S2', nome: 'Comercial', parent_id: 'S', responsavel_employee_id: null, ordem: 2 }],
  cargos: [
    { id: 'ceo', nome: 'CEO', descricao: null, nivel: 1, departamento_id: 'S', reporta_a_cargo_id: null, faixa_min: null, faixa_max: null },
    { id: 'ger', nome: 'Gerente', descricao: null, nivel: 2, departamento_id: 'S2', reporta_a_cargo_id: 'ceo', faixa_min: null, faixa_max: null },
    { id: 'sdr', nome: 'SDR', descricao: null, nivel: 3, departamento_id: 'S2', reporta_a_cargo_id: 'ger', faixa_min: null, faixa_max: null },
  ],
  pessoas: [
    { id: 'p1', nome: 'Ana', gestor_id: null, cargo_catalogo_id: 'ceo', avatar_url: null },
    { id: 'p2', nome: 'Bruno', gestor_id: null, cargo_catalogo_id: 'ger', avatar_url: null },
    { id: 'p3', nome: 'Caio', gestor_id: 'p1', cargo_catalogo_id: 'sdr', avatar_url: null },
  ],
  vinculos: [
    { id: 'v1', employee_id: 'p1', cargo_id: 'ceo', departamento_id: 'S', data_inicio: '2025-01-01', data_fim: null, interino: false },
    { id: 'v2', employee_id: 'p2', cargo_id: 'ger', departamento_id: 'S2', data_inicio: '2026-06-01', data_fim: null, interino: false },
    { id: 'v3', employee_id: 'p3', cargo_id: 'sdr', departamento_id: 'S2', data_inicio: '2025-01-01', data_fim: null, interino: false },
  ],
};

// Superior pelo cargo; cargo vago sobe até o próximo ocupante
const hoje = montarModelo(raw, '2026-11-05', '2026-11-05');
assert.equal(hoje.superior.get('p3'), 'p2');
const antes = montarModelo(raw, '2026-01-01', '2026-11-05');
assert.equal(antes.superior.get('p3'), 'p1');
assert.equal(antes.ocupantes.get('ger'), undefined); // vago no passado

// Ciclos
const pais = mapaPais(hoje, 'cargos');
assert.equal(criaCiclo(pais, 'ceo', 'sdr'), true);
assert.equal(criaCiclo(pais, 'sdr', 'ceo'), false);
assert.deepEqual(caminhoAteTopo(pais, 'sdr'), ['sdr', 'ger', 'ceo']);

// Dois primeiros níveis abertos
const rec = recolhidosIniciais(pais);
assert.deepEqual([...rec], ['ger']);
assert.deepEqual([...visiveis(pais, rec, new Set(pais.keys()))].sort(), ['ceo', 'ger']);

// Layout de cima para baixo
const pos = layoutHierarquico(['ceo', 'ger'], [['ceo', 'ger']], () => ({ w: 100, h: 50 }));
assert.ok(pos.get('ger')!.y > pos.get('ceo')!.y);
console.log('estruturaOrg: ok');
