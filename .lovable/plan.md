

## Trocar KPI No-Show para Taxa de No-Show (%) — quanto menor, melhor

### Problema

O card "No-Show" mostra o número absoluto (39) com meta (29). Para o gestor, o que importa é a **taxa de no-show** — e a lógica deve ser invertida: ultrapassar a meta é **ruim**, ficar abaixo é **bom**.

Atualmente: No-Show = 39, meta = 29, "Acima: +10" aparece em verde (errado — deveria ser vermelho).

### Solução

Substituir o KPI "No-Show" por "Taxa No-Show" em formato percentual:

| Campo | Valor |
|-------|-------|
| **Label** | Taxa No-Show |
| **Valor** | `(noShows / agendamentos) * 100` → ex: (39/96) = 40.6% |
| **Meta** | 30% (meta fixa — no máximo 30% de no-show) |
| **Lógica invertida** | Abaixo da meta = bom (verde), acima = ruim (vermelho) |

### Mudanças

**Arquivo 1: `src/hooks/useSdrPerformanceData.ts`**
- Substituir `makeMetric("No-Show", ...)` por um objeto manual com:
  - `realized`: taxa no-show calculada
  - `meta`: 30
  - `format: "percent"`
  - `invertGap: true` (novo campo) — para o card saber que gap negativo é bom

**Arquivo 2: `src/hooks/useSdrPerformanceData.ts` (interface)**
- Adicionar `invertGap?: boolean` à interface `MetricWithMeta`

**Arquivo 3: `src/components/sdr/SdrDetailKPICards.tsx`**
- Quando `metric.invertGap === true`, inverter as cores:
  - gap < 0 (abaixo da meta) → verde ("Abaixo: -X%" com ✓)
  - gap > 0 (acima da meta) → vermelho ("Acima: +X%")
- Inverter também a cor da barra de progresso/attainment

### Resultado visual

```text
┌─────────────────────────┐
│ TAXA NO-SHOW        ⓘ  │
│ 40.6%                   │
│ ████████████████░  135%  │  ← vermelho (passou da meta)
│ Meta: 30%               │
│ Acima: +10.6%           │  ← vermelho
└─────────────────────────┘
```

### Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useSdrPerformanceData.ts` | Trocar No-Show absoluto por Taxa No-Show %, adicionar `invertGap` à interface |
| `src/components/sdr/SdrDetailKPICards.tsx` | Respeitar `invertGap` para inverter cores de gap e attainment |

