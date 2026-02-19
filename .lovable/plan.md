

# Corrigir Calculo do Card "Liquido Total" - Dupla Contagem com Order Bumps

## Problema

O fix anterior corrigiu o valor liquido **nas linhas da tabela** (dentro dos grupos), mas o card **"Liquido Total"** no topo da pagina ainda esta somando `net_value` de TODAS as transacoes individuais, incluindo o main + offers, causando dupla contagem.

### Onde esta o bug

Arquivo `src/pages/bu-incorporador/TransacoesIncorp.tsx`, linhas 186-197:

```text
const totals = useMemo(() => {
  filteredByCloser.forEach(t => {
    liquido += t.net_value || 0;   // <-- soma TODAS as transacoes, incluindo main duplicado
  });
  ...
}, [filteredByCloser, globalFirstIds]);
```

O `filteredByCloser` contem as transacoes individuais (main + offers), entao o main (que ja e a soma dos offers) e somado novamente.

## Solucao

Alterar o calculo de `totals` para usar os **grupos ja calculados** (`transactionGroups`) em vez das transacoes individuais. Os grupos ja tem `totalNet` e `totalGross` corrigidos pelo fix anterior.

### Arquivo: `src/pages/bu-incorporador/TransacoesIncorp.tsx`

Alterar o `useMemo` de totals (linhas 186-197) para:

```text
const totals = useMemo(() => {
  let bruto = 0;
  let liquido = 0;

  transactionGroups.forEach(group => {
    bruto += group.totalGross;
    liquido += group.totalNet;
  });

  return { count: filteredByCloser.length, bruto, liquido };
}, [transactionGroups, filteredByCloser]);
```

Isso garante que:
- O liquido usa a soma dos grupos (que exclui o main quando ha offers)
- O bruto tambem usa a soma dos grupos (consistente)
- O count continua sendo o numero total de transacoes individuais

## Impacto

- O card "Liquido Total" passara a mostrar o valor correto (sem dupla contagem)
- O card "Bruto Total" tambem sera consistente com as linhas da tabela
- Nenhuma outra pagina e afetada (cada BU tem seu proprio calculo)

