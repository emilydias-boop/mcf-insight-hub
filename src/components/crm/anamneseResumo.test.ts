import { distribuirResumo } from './anamneseResumo';

/** Sem dependência de runner: roda com `bun src/components/crm/anamneseResumo.test.ts`. */
const resumo = `Contato: Nascimento — 02/05/1974; Profissão — Advogado
Objetivos: O que busca na MCF — Construir para vender; Quantidade de imóveis — 0
Sobre o cliente: Valores importantes — liquidez`;

const { secoes, resto } = distribuirResumo(resumo, [
  { chave: 'contato', titulo: 'Contato', campos: [] },
  { chave: 'objetivos', titulo: 'Objetivos', campos: [{ label: 'X', valor: 'Y' }] },
]);
const igual = (a: unknown, b: unknown, msg: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: ${JSON.stringify(a)}`);
};
igual(secoes[0].campos, [
  { label: 'Nascimento', valor: '02/05/1974' },
  { label: 'Profissão', valor: 'Advogado' },
], 'contato');
igual(secoes[1].campos, [{ label: 'X', valor: 'Y' }], 'objetivos preservado');
igual(secoes[2].titulo, 'Sobre o cliente', 'nova seção');
igual(secoes[2].campos, [{ label: 'Valores importantes', valor: 'liquidez' }], 'sobre o cliente');
igual(resto, '', 'resto');
console.log('anamneseResumo: ok');
