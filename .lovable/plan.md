
# Fix: Selecao de Quantidade e Escopo de Selecao

## Problemas encontrados

1. **Seleciona todos os filtrados, nao so a pagina atual**: `toggleSelectAll` usa indices do array `filtered` inteiro (1802 itens), ignorando a paginacao. O usuario ve 25 por pagina mas ao marcar "todos", marca os 1802.
2. **Sem controle de quantidade**: Nao ha campo para digitar quantos leads selecionar (ex: selecionar os primeiros 100).

## Solucao

### Arquivo: `src/pages/crm/LeadsLimbo.tsx`

### 1. Corrigir `toggleSelectAll` para operar apenas na pagina atual
- Alterar a funcao para iterar sobre `paged` (itens da pagina visivel) em vez de `filtered`
- Calcular o indice real no array `filtered` baseado na pagina atual: `page * pageSize + i`

### 2. Adicionar campo de quantidade na barra de selecao
- Novo estado `selectCount` (string) para o input de quantidade
- Adicionar um Input numerico ao lado do checkbox "Selecionar todos" ou na barra de acoes
- Botao "Selecionar X" que marca os primeiros X leads `sem_dono` do array `filtered` (respeitando os filtros ativos)
- Isso permite a gestora filtrar por estagio/dono e depois selecionar uma quantidade especifica

### 3. Atualizar o `toggleSelect` para usar indices globais de `filtered`
- Atualmente usa `idx` que e o indice dentro de `filtered`, o que ja esta correto
- O problema e que na renderizacao, o checkbox usa o indice de `paged` mas precisa mapear para o indice de `filtered`
- Corrigir para que o checkbox de cada linha use `page * pageSize + localIndex` como indice

### 4. Detalhes da implementacao

**Novos estados:**
```
const [selectCount, setSelectCount] = useState('');
```

**toggleSelectAll corrigido (apenas pagina):**
```
const toggleSelectAll = () => {
  const pageStart = page * pageSize;
  const pageIndices = paged
    .map((r, i) => ({ r, globalIdx: showAll ? i : pageStart + i }))
    .filter(({ r }) => r.status === 'sem_dono' && r.localDealId);

  const allPageSelected = pageIndices.every(({ globalIdx }) => selectedIds.has(globalIdx));

  if (allPageSelected) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      pageIndices.forEach(({ globalIdx }) => next.delete(globalIdx));
      return next;
    });
  } else {
    setSelectedIds(prev => {
      const next = new Set(prev);
      pageIndices.forEach(({ globalIdx }) => next.add(globalIdx));
      return next;
    });
  }
};
```

**Nova funcao selectByCount:**
```
const selectByCount = (count: number) => {
  const ids = new Set<number>();
  let added = 0;
  for (let i = 0; i < filtered.length && added < count; i++) {
    if (filtered[i].status === 'sem_dono' && filtered[i].localDealId) {
      ids.add(i);
      added++;
    }
  }
  setSelectedIds(ids);
};
```

**UI na barra de acoes (abaixo dos filtros):**
- Input numerico com placeholder "Qtd" 
- Botao "Selecionar" ao lado do input
- Botao "Selecionar todos filtrados" para marcar todos os sem_dono do filtro atual
- O texto "X leads selecionados" mostra apenas os efetivamente selecionados

### 5. Corrigir indices do checkbox nas linhas
Na renderizacao das linhas da tabela, o indice usado no checkbox deve ser o indice global dentro de `filtered`, nao o indice local de `paged`:
```
{paged.map((row, localIdx) => {
  const globalIdx = showAll ? localIdx : page * pageSize + localIdx;
  // usar globalIdx no toggleSelect e selectedIds.has
})}
```
