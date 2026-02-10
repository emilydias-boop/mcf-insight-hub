
# Corrigir 4 Closers "Desconhecido" no Painel Consorcio

## Causa raiz
O hook `useR1CloserMetrics` busca **todas** as reunioes R1 do periodo (sem filtro de BU), mas so carrega closers da BU selecionada. Quando uma reuniao pertence a um closer de outra BU (ex: incorporador), o sistema nao encontra o nome e exibe "Desconhecido".

## Correcao

### Arquivo: `src/hooks/useR1CloserMetrics.ts` (linhas 392-413)

Adicionar um filtro para ignorar reunioes cujo `closer_id` nao pertence a nenhum closer da BU atual. Em vez de criar entradas "Desconhecido", simplesmente pular essas reunioes.

Logica atual (linha 397-412):
```text
if (!metric) {
  // Cria entrada com nome "Desconhecido" para closers de outra BU
  metricsMap.set(closerId, { closer_name: 'Desconhecido', ... });
}
```

Logica corrigida:
```text
if (!metric) {
  // Se o closer nao pertence a esta BU, ignorar a reuniao
  const closerInfo = closers?.find(c => c.id === closerId);
  if (!closerInfo) return; // <-- SKIP, nao criar "Desconhecido"
  // ... criar metrica apenas se o closer existe na BU
}
```

### Resultado
- Os 4 closers "Desconhecido" desaparecem do painel Consorcio
- Apenas closers da BU correta sao exibidos
- Nenhum impacto no painel do Incorporador (que ja filtra por `bu='incorporador'`)
