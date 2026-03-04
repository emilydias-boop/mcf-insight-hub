

## Problema

O componente `DynamicIndicatorsSection` (que renderiza "Indicadores de Meta") aparece **duas vezes** na página de detalhe do fechamento (`Detail.tsx`):

1. **Linha 529** — dentro do bloco `!fechamento_manual` (correto)
2. **Linha 544** — fora do bloco, renderizado sempre (duplicata)

## Correção

Remover as linhas 543-554 (o segundo `DynamicIndicatorsSection` duplicado) do `Detail.tsx`. O primeiro dentro do bloco condicional (linha 529-539) é o correto e será mantido.

```text
Antes:
  <>
    {canEdit && <KpiEditForm ... />}
    <DynamicIndicatorsSection ... />   ← correto (dentro do bloco)
  </>
)}

{/* Dynamic Indicators Grid */}
<DynamicIndicatorsSection ... />       ← DUPLICATA (fora do bloco)

Depois:
  <>
    {canEdit && <KpiEditForm ... />}
    <DynamicIndicatorsSection ... />   ← correto (dentro do bloco)
  </>
)}
```

Apenas 1 arquivo modificado: `src/pages/fechamento-sdr/Detail.tsx` (remover linhas 543-554).

