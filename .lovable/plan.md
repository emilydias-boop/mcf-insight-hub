

## Diagnóstico: Layout do Calendário Semana quebrado

### Causa raiz

O `gridCols` em `AgendaCalendar.tsx` (linha 894-896) usa template literals dinâmicos para gerar classes Tailwind:

```text
`grid-cols-[60px_repeat(${viewDays.length},1fr)]`
```

Tailwind JIT **não consegue detectar classes construídas dinamicamente** — o scanner de classes procura strings completas no código-fonte. Como `viewDays.length` é um valor runtime, a classe CSS `grid-cols-[60px_repeat(5,1fr)]` nunca é gerada. O grid colapsa em coluna única, empilhando os dias verticalmente.

A view "Dia" do R1 funciona porque o número de closers pode coincidir com classes já geradas em outros contextos, ou renderiza diferentemente.

### Correção

Substituir as classes Tailwind dinâmicas por **inline styles** (`style={{ gridTemplateColumns: ... }}`), que funcionam independentemente do Tailwind JIT.

### Arquivos a editar

**`src/components/crm/AgendaCalendar.tsx`**:

1. **Linha ~894-896**: Trocar `gridCols` de classe Tailwind para um objeto de estilo inline:
   ```typescript
   const gridStyle = {
     gridTemplateColumns: viewMode === 'day'
       ? `60px repeat(${numCloserColumns}, 1fr)`
       : `60px repeat(${viewDays.length}, 1fr)`
   };
   ```

2. **Todas as referências a `gridCols`** (header na linha ~950, cada time slot row na linha ~1044): Substituir `className={cn('grid ...', gridCols)}` por `className={cn('grid ...')} style={gridStyle}`.

Isso garante que o grid sempre terá as colunas corretas, independentemente do número de dias ou closers.

