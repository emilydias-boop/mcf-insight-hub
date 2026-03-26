

## Corrigir metas de Contratos e Ligações

### Problemas

1. **Contratos meta** (linha 197): calcula 30% da **meta** de R1 Realizada. O correto é 30% do **R1 Realizada real** (`sm.r1Realizada`).
2. **Total Ligações** (linha 263): meta está 0. O correto é **84 × dias úteis do período**.
3. **Taxa Contato** (linha 253): meta hardcoded em 40% — manter (não foi contestada).

### Mudanças no `src/hooks/useSdrPerformanceData.ts`

**Metas derivadas (linhas 191-199)**:
```ts
const r1Realizada_real = sm?.r1Realizada || 0;
const contratosMeta = Math.round(r1Realizada_real * 0.3);
const ligacoesMeta = 84 * businessDaysTotal; // 84 ligações/dia × dias úteis
```

**Contratos makeMetric (linha 235)**: já usa `metas.contratosMeta` — ajuste automático.

**Total Ligações (linhas 260-268)**: usar `metas.ligacoesMeta` como meta, calcular attainment e gap.

### Resultado esperado

| Métrica | Meta | Cálculo |
|---------|------|---------|
| Contratos | 30% do R1 Realizada **real** | Ex: 22 realizadas → meta 7 |
| Total Ligações | 84 × dias úteis | Ex: 84 × 21 = 1.764 |

### Arquivo afetado

| Arquivo | Ação |
|---------|------|
| `src/hooks/useSdrPerformanceData.ts` | Corrigir contratosMeta (30% do real), adicionar ligacoesMeta (84 × dias úteis) |

