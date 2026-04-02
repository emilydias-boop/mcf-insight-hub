
## Corrigir inconsistência de Total Conta entre tabela e página individual

### Problema
A tabela usa `payout.total_conta` do banco (R$ 4.900) como fallback quando as métricas não carregam a tempo, enquanto a página individual calcula em tempo real (R$ 6.370 = fixo + variável calculado).

### Causa raiz
O `PayoutTableRow` depende de `metricas.length > 0` para decidir se usa o valor calculado ou o do banco. Se o hook `useActiveMetricsForSdr` não resolve o `cargo_catalogo_id` para o Closer na tabela (problema de timing com múltiplas rows carregando simultaneamente), cai no fallback do DB onde `valor_variavel_total = 0`.

### Solução (duas frentes)

**1. Garantir que o "Recalcular Todos" salve valores corretos no banco**
- **`src/hooks/useSdrFechamento.ts`** — na função de recalculate, usar a mesma lógica de peso percentual para gravar `valor_variavel_total` e `total_conta` corretos no banco
- Assim mesmo o fallback mostra valores corretos

**2. Remover fallback inconsistente na tabela**
- **`src/components/fechamento/PayoutTableRow.tsx`** — enquanto as métricas carregam, mostrar um skeleton/loading em vez de mostrar o valor errado do banco
- Quando `metricas` ainda estão carregando (hook em loading), exibir indicador visual
- Só mostrar fallback do banco se o hook terminou e realmente não encontrou métricas

### Alterações

1. **`src/components/fechamento/PayoutTableRow.tsx`**
   - Importar `isLoading` do `useActiveMetricsForSdr` (o hook já retorna isso)
   - Se `isLoading`, mostrar skeleton nos campos Variável e Total Conta
   - Se métricas carregadas e vazias, aí sim usar fallback do DB

2. **`src/hooks/useSdrFechamento.ts`** — na mutation `recalculateAll` / `recalculateWithKpi`
   - Ao salvar o payout, calcular `valor_variavel_total` e `total_conta` usando os pesos das métricas ativas (mesma lógica do `useCalculatedVariavel`)
   - Isso garante que o banco sempre tenha os valores atualizados

### Resultado esperado
- Tabela mostra loading enquanto métricas carregam, depois exibe o valor correto calculado
- Após "Recalcular Todos", o banco tem os valores corretos, eliminando discrepância mesmo no fallback
