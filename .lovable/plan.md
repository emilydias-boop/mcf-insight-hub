

## Corrigir cálculo de metas derivadas — usar valores reais

### Problema

No `useSdrPerformanceData.ts` (linhas 191-196), as metas de R1 Realizada, No-Show e Contratos são calculadas a partir da **meta fixa** de R1 Agendada (= metaPeriodo). Isso está errado.

A lógica correta (já documentada nas regras de negócio do sistema) é:

| Métrica | Cálculo correto |
|---------|----------------|
| R1 Realizada meta | 70% do **R1 Agendada real** |
| No-Show meta | 30% do **R1 Agendada real** |
| Contratos meta | 30% da **meta de R1 Realizada** (derivada acima) |

### Exemplo com dados da tela

- R1 Agendada real = 47
- R1 Realizada meta = round(47 × 0.7) = **33**
- No-Show meta = round(47 × 0.3) = **14**
- Contratos meta = round(33 × 0.3) = **10**

### Mudança

**Arquivo**: `src/hooks/useSdrPerformanceData.ts` (linhas 191-197)

Trocar:
```ts
const r1AgendadaMeta = agendMeta;
const r1RealizadaMeta = Math.round(r1AgendadaMeta * 0.7);
const contratosMeta = Math.round(r1RealizadaMeta * 0.3);
```

Por:
```ts
const r1AgendadaMeta = agendMeta; // meta fixa, mantida
const r1Agendada_real = sm?.r1Agendada || 0;
const r1RealizadaMeta = Math.round(r1Agendada_real * 0.7);
const noShowMeta = Math.round(r1Agendada_real * 0.3);
const contratosMeta = Math.round(r1RealizadaMeta * 0.3);
```

E atualizar a linha 245 (No-Show) para usar `noShowMeta` em vez de `Math.round(metas.r1AgendadaMeta * 0.3)`.

Adicionar `sm` como dependência do `useMemo` de metas.

### Arquivo afetado

| Arquivo | Ação |
|---------|------|
| `src/hooks/useSdrPerformanceData.ts` | Corrigir cálculo de metas derivadas — usar R1 Agendada real |

