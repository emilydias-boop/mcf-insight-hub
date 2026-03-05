

## Plano: Carregar todos ao filtrar parceria + Selecionar todos filtrados

### Problemas identificados

1. **Filtro "Qualquer parceria"** — A detecção de parceiros roda apenas sobre contatos já carregados (lotes de 500). Se há 110k contatos e só 500 foram carregados, muitos parceiros ficam de fora.

2. **"Selecionar todos"** — Seleciona apenas os contatos carregados e filtrados. Se o filtro mostra 158 de 465 carregados, mas no total existiriam 2000 parceiros nos 110k, o usuário quer selecionar todos os 2000.

### Solução

**Carregar tudo automaticamente quando filtro de parceria está ativo:**

**`src/pages/crm/Contatos.tsx`**
- Quando `filters.partnerProduct` estiver preenchido e `hasNextPage === true`, disparar `fetchNextPage()` automaticamente em loop (via `useEffect`) até não haver mais páginas
- Mostrar indicador de progresso: "Carregando todos os contatos para filtrar parcerias... (2500 de 110000)"
- O `partnerMap` vai sendo atualizado conforme novos contatos são carregados (já funciona reativamente)

**"Selecionar todos" inteligente:**
- Ao clicar "Selecionar todos (N)", primeiro garantir que todas as páginas foram carregadas (mesmo mecanismo de auto-load)
- Enquanto carrega, mostrar estado de loading no checkbox
- Após carregar tudo, selecionar todos os `filteredContacts`

### Alterações por arquivo

**`src/pages/crm/Contatos.tsx`**
- Adicionar `useEffect` que detecta filtro de parceria ativo + `hasNextPage` e chama `fetchNextPage()` em sequência
- Adicionar estado `isLoadingAll` para controlar o indicador visual
- Modificar `handleSelectAll` para disparar carregamento completo antes de selecionar
- Adicionar barra de progresso/texto durante carregamento massivo

**Nenhuma alteração** nos hooks ou outros componentes — o `useInfiniteQuery` já suporta carregar todas as páginas via `fetchNextPage()`.

### Fluxo do usuário
1. Seleciona "Qualquer parceria" no filtro
2. Sistema começa a carregar todas as páginas automaticamente (barra de progresso)
3. Conforme carrega, contatos parceiros vão aparecendo
4. Ao finalizar, todos os parceiros estão visíveis
5. "Selecionar todos (2000)" seleciona de fato os 2000
6. Usuário envia para pipeline normalmente

### Cuidado com performance
- O carregamento em loop usa `isFetchingNextPage` como guard para não disparar múltiplas chamadas simultâneas
- Cada página carrega 500 contatos; 110k = ~220 requests sequenciais. Para parceria, é viável pois o filtro reduz drasticamente

