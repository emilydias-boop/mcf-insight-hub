

## Remover KPI "R1 Agendada" e usar Agendamentos como base dos cálculos

### Problema

A tela mostra "Agendamentos" e "R1 Agendada" lado a lado com valores diferentes (37 vs 47), o que confunde o gestor. Para o SDR, o número que importa é quantos agendamentos ele fez **no período** — e as metas derivadas (R1 Realizada, No-Show, Contratos) devem partir desse valor.

### Mudança

**Arquivo**: `src/hooks/useSdrPerformanceData.ts`

1. **Metas derivadas** (linhas 191-200): trocar `sm?.r1Agendada` por `sm?.agendamentos` como base:
   - `r1RealizadaMeta = round(agendamentos_real * 0.7)`
   - `noShowMeta = round(agendamentos_real * 0.3)`
   - `contratosMeta = round(r1RealizadaMeta * 0.3)`

2. **Remover linha 234**: `makeMetric("R1 Agendada", "r1Agendada", ...)` — eliminar esse KPI do array de métricas

3. Remover `r1AgendadaMeta` do objeto `metas` (não é mais usado)

### Resultado

- KPI cards: Agendamentos → R1 Realizada → Contratos → Taxa Contrato → No-Show → Taxa Contato → Ligações → Tempo Médio
- Metas derivadas partem dos **37 agendamentos** do período
- R1 Realizada meta = round(37 × 0.7) = **26**
- No-Show meta = round(37 × 0.3) = **11**
- Contratos meta = round(26 × 0.3) = **8**

| Arquivo | Ação |
|---------|------|
| `src/hooks/useSdrPerformanceData.ts` | Remover R1 Agendada do array de métricas, derivar metas a partir de agendamentos reais |

