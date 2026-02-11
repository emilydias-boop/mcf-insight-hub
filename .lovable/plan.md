

# Corrigir erro "Too many re-renders" na aba Realizadas

## Causa raiz
Na linha 69 do arquivo `PosReuniao.tsx`, o `setCurrentPage(1)` esta sendo chamado dentro de um `useMemo`. Isso dispara um setState durante o render, que causa um novo render, que executa o useMemo novamente, criando um loop infinito.

## Correcao

### Arquivo: `src/pages/crm/PosReuniao.tsx`

Remover o `setCurrentPage(1)` de dentro do `useMemo` (linha 69) e adicionar um `useEffect` separado que reseta a pagina quando os filtros mudam:

```ts
// Adicionar useEffect ao import (linha 1)
import { useState, useMemo, useEffect } from 'react';

// Remover setCurrentPage(1) de dentro do useMemo
const filtered = useMemo(() => {
  return realizadas.filter(r => {
    // ... mesma logica de filtro, sem o setCurrentPage
  });
}, [realizadas, searchTerm, pipelineFilter, closerFilter, dateFrom, dateTo]);

// Adicionar useEffect para resetar pagina
useEffect(() => {
  setCurrentPage(1);
}, [searchTerm, pipelineFilter, closerFilter, dateFrom, dateTo]);
```

1 arquivo modificado, 3 linhas alteradas.

