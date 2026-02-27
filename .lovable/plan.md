

## Adicionar linha "Outside" na tabela de Closers

### O que muda

Na `CloserSummaryTable`, adicionar uma linha dedicada **"Outside"** entre as linhas dos closers e a linha de Total. Essa linha mostra a soma de outsides (leads que compraram antes da R1).

A linha de **Total** passa a somar `contrato_pago + outside` na coluna "Contrato Pago", igualando o valor do KPI.

### Implementação

**`src/components/sdr/CloserSummaryTable.tsx`**:

1. Após o `data.map(...)` dos closers, inserir uma `TableRow` estilizada (fundo laranja sutil) com:
   - Coluna nome: "Outside" (com ícone ou badge laranja)
   - Colunas R1 Agendada, R1 Realizada, No-show, Taxa No-Show, R2 Agendada: vazias ou "—"
   - Coluna "Contrato Pago": `totals.outside` (a soma dos outsides de todos os closers)

2. Na linha **Total**, coluna "Contrato Pago": mostrar `totals.contrato_pago + totals.outside` para bater com o KPI

3. Manter a coluna "Outside" por closer como está (mostra quantos outsides cada closer teve na R1)

### Resultado visual

```text
Closer       | R1 Agend | Outside | R1 Real | ... | Contrato Pago | ...
─────────────┼──────────┼─────────┼─────────┼─────┼───────────────┼────
Closer A     |    25    |    3    |   18    | ... |      12       | ...
Closer B     |    30    |    5    |   22    | ... |      15       | ...
─── Outside ─┼─────────-┼─────────┼─────────┼─────┼───── 22 ──────┼────
═══ Total ═══|    55    |   22    |   40    | ... |    183+22=205 | ...
```

