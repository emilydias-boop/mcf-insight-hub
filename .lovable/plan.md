

# Fix: KPIs devem acompanhar a aba ativa (Cliente/Empresa)

## Problema
Os KPIs e alertas são calculados sobre `processedData` (todos os dados), mas o filtro `tipoFilter` (cliente/empresa) só é aplicado depois, na `filteredData` usada pela tabela. Isso faz com que ambas as abas mostrem os mesmos valores nos KPIs.

## Correção

### Arquivo: `src/hooks/useConsorcioPagamentos.ts`

Aplicar o `tipoFilter` **antes** de calcular KPIs e alertas:

1. Criar um `tipoFilteredData` logo após `processedData` (linha ~218):
```typescript
const tipoFilteredData = useMemo(() => {
  return tipoFilter ? processedData.filter(r => r.tipo === tipoFilter) : processedData;
}, [processedData, tipoFilter]);
```

2. Alterar o cálculo de `kpis` (linha 231) para iterar sobre `tipoFilteredData` em vez de `processedData`

3. Alterar o cálculo de `alertData` para usar `tipoFilteredData`

4. Alterar `filteredData` para partir de `tipoFilteredData` (remover o filtro de tipo duplicado na linha 259)

5. Alterar `filterOptions` para usar `tipoFilteredData`

Resultado: cada aba mostra seus próprios totais de recebido, pendente, atraso, parcelas, e cotas.

