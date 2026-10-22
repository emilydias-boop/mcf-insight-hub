import { distribuirResumo } from './anamneseResumo';

const resumo = `Contato: Nascimento — 02/05/1974; Profissão — Advogado
Objetivos: O que busca na MCF — Construir para vender; Quantidade de imóveis — 0
Sobre o cliente: Valores importantes — liquidez`;

describe('distribuirResumo', () => {
  it('coloca cada linha no bloco certo e preserva blocos já preenchidos', () => {
    const { secoes, resto } = distribuirResumo(resumo, [
      { chave: 'contato', titulo: 'Contato', campos: [] },
      { chave: 'objetivos', titulo: 'Objetivos', campos: [{ label: 'X', valor: 'Y' }] },
    ]);
    expect(secoes[0].campos).toEqual([
      { label: 'Nascimento', valor: '02/05/1974' },
      { label: 'Profissão', valor: 'Advogado' },
    ]);
    expect(secoes[1].campos).toEqual([{ label: 'X', valor: 'Y' }]);
    expect(secoes[2].titulo).toBe('Sobre o cliente');
    expect(secoes[2].campos).toEqual([{ label: 'Valores importantes', valor: 'liquidez' }]);
    expect(resto).toBe('');
  });
});
