
# Corrigir filtro de categorias que nao esta sendo aplicado

## Diagnostico

O codigo do filtro esta correto sintaticamente, mas ha um problema tecnico: a constante `ALLOWED_INCORPORADOR_CATEGORIES` esta definida **dentro** do corpo do componente (recriada a cada render), porem o `useMemo` que a utiliza tem como dependencias apenas `[transactions, closers, attendees, globalFirstIds]`. 

Alem disso, o filtro so se aplica quando `bu === 'incorporador'`, mas atualmente ele filtra **sempre**, mesmo para outras BUs. Precisamos condicionar o filtro a BU.

O problema principal e que o componente `CloserRevenueSummaryTable` nao recebe a prop `bu`, entao nao sabe quando aplicar o filtro. Como o filtro esta sendo aplicado incondicionalmente e o Set esta correto, a causa real e provavelmente que a **preview nao recarregou** o componente apos a ultima edicao.

## Solucao

1. **Mover a constante para fora do componente** (nivel de modulo) para garantir estabilidade e evitar recriacao desnecessaria.

2. **Passar a prop `bu` para o `CloserRevenueSummaryTable`** e condicionar o filtro: so aplicar quando `bu === 'incorporador'`.

3. **Adicionar um `console.log` temporario** para debug, confirmando quantas transacoes sao filtradas (remover depois).

## Detalhes tecnicos

### Arquivo: `src/components/relatorios/CloserRevenueSummaryTable.tsx`

- Mover `ALLOWED_INCORPORADOR_CATEGORIES` para fora do componente (constante de modulo)
- Adicionar prop `bu?: string` na interface do componente
- Condicionar o filtro: `if (bu === 'incorporador')` aplicar allowlist, caso contrario usar todas as transacoes

```typescript
// No topo do arquivo (fora do componente)
const ALLOWED_INCORPORADOR_CATEGORIES = new Set([
  'contrato', 'incorporador', 'parceria', 'a010',
  'renovacao', 'ob_vitalicio', 'contrato-anticrise', 'p2',
]);

// Dentro do useMemo
const filteredTxs = bu === 'incorporador'
  ? transactions.filter(tx => {
      const cat = tx.product_category || '';
      return ALLOWED_INCORPORADOR_CATEGORIES.has(cat) || cat === '';
    })
  : transactions;
```

### Arquivo: `src/components/relatorios/SalesReportPanel.tsx`

- Passar a prop `bu` ao componente `CloserRevenueSummaryTable`:

```tsx
<CloserRevenueSummaryTable
  transactions={filteredTransactions as any}
  closers={closers}
  attendees={attendees as any}
  globalFirstIds={globalFirstIds}
  isLoading={isLoading}
  startDate={dateRange?.from}
  endDate={dateRange?.to}
  bu={bu}
/>
```

### Resultado esperado

- O filtro de allowlist sera aplicado apenas para a BU Incorporador
- A constante sera estavel no nivel do modulo (sem recriacao)
- O "Sem Closer" devera cair de 43 para aproximadamente 33 (excluindo as 10 transacoes de `ob_evento`)
