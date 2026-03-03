

## Problema

O filtro Outside para de funcionar quando você clica em um lead e fecha o drawer. A causa:

1. Ao interagir com o drawer (ligar, anotar, mover estágio), vários hooks chamam `invalidateQueries({ queryKey: ['crm-deals'] })`
2. Isso refaz o fetch de `dealsData`, que muda a referência do array
3. O hook `useOutsideDetectionForDeals` recalcula o `queryKey` baseado nos IDs dos deals — gerando uma nova query
4. **Durante o refetch**, `outsideMap` fica `undefined` momentaneamente
5. A condição do filtro (linha 502): `if (filters.outsideFilter !== 'all' && outsideMap)` — quando `outsideMap` é `undefined`, o bloco inteiro é **ignorado**, e todos os deals passam no filtro, mostrando "Todos"

O filtro em si permanece selecionado na UI, mas os dados filtrados mostram tudo porque a condição de guarda falha silenciosamente.

## Correção

### 1. Manter `outsideMap` estável durante refetch (`Negocios.tsx`)

Usar `placeholderData: keepPreviousData` ou manter um ref do último `outsideMap` válido para que, durante refetches, o mapa anterior continue sendo usado no filtro:

- Criar um `useRef` para armazenar o último `outsideMap` válido
- No `useMemo` de `filteredDeals`, usar `outsideMap || outsideMapRef.current` em vez de apenas `outsideMap`
- Atualizar o ref quando `outsideMap` muda

### 2. Ajustar o `useOutsideDetectionForDeals` para manter dados anteriores

No hook `useOutsideDetectionForDeals.ts`, adicionar `placeholderData: (previousData) => previousData` na config do `useQuery`. Isso faz o React Query manter o resultado anterior enquanto refaz o fetch com o novo queryKey, evitando o flash de `undefined`.

### 3. Adicionar `outsideMap` como dependência estável no filtro (`Negocios.tsx`)

Mudar a condição do filtro de:
```typescript
if (filters.outsideFilter !== 'all' && outsideMap) {
```
Para:
```typescript
if (filters.outsideFilter !== 'all') {
  if (!outsideMap) return false; // Esconder deals enquanto outsideMap carrega
```

Isso inverte o comportamento: em vez de mostrar tudo quando o mapa não está pronto, **esconde** deals até o mapa estar disponível, evitando o flash de "todos os deals".

### Resultado

- O filtro Outside permanece funcional mesmo após abrir/fechar o drawer
- Sem flash de "todos os deals" durante refetches
- A UI mantém o estado filtrado consistente

