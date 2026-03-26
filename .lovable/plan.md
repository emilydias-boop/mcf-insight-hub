

## Simplificar coluna Meta — mostrar apenas o número da meta

### Problema
A coluna "Meta" mostra `11/10` (agendamentos/meta), mas a coluna "Agendamento" ao lado já mostra `11`. Fica duplicado e confuso.

### Solução
A coluna **Meta** mostra **apenas o número da meta** (ex: `10`), com cor indicando se bateu ou não:
- **Verde**: agendamentos ≥ meta
- **Vermelho**: agendamentos < meta

O número da meta em si fica em destaque. Quem olhar entende: "a meta é 10" e compara visualmente com a coluna Agendamento ao lado.

### Arquivo
`src/components/sdr/SdrSummaryTable.tsx` — linhas 139-143: trocar `{row.agendamentos}/{metaPeriodo}` para apenas `{metaPeriodo}`, mantendo a cor condicional verde/vermelho baseada em `bateuMeta`.

