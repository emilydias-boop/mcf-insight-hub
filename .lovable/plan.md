
# Plano: Alterar Taxa de Conversão de SDRs para Contrato/Realizada

## Problema

A Taxa de Conversão no KPI Card dos SDRs está calculada como:
- **Atual**: `Realizadas / Agendamentos × 100` = 60.9% (28/46)
- **Desejado**: `Contratos / Realizadas × 100` = 53.6% (15/28)

Isso faz mais sentido porque mede quantas reuniões realizadas realmente convertem em contratos.

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useTeamMeetingsData.ts` | **Modificar** - Alterar fórmula da taxaConversao |
| `src/components/sdr/TeamKPICards.tsx` | **Modificar** - Atualizar tooltip |

---

## Alterações

### 1. useTeamMeetingsData.ts (linhas 88-90)

De:
```typescript
const taxaConversao = totalAgendamentos > 0
  ? (totalRealizadas / totalAgendamentos) * 100
  : 0;
```

Para:
```typescript
const taxaConversao = totalRealizadas > 0
  ? (totalContratos / totalRealizadas) * 100
  : 0;
```

### 2. TeamKPICards.tsx (linha 84)

De:
```typescript
tooltip: "Realizadas / Total Agendamentos × 100"
```

Para:
```typescript
tooltip: "Contratos / Realizadas × 100"
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Taxa Conversão (28/01) | 60.9% (28/46) | 53.6% (15/28) |
| Tooltip | "Realizadas / Total Agendamentos × 100" | "Contratos / Realizadas × 100" |

A nova Taxa de Conversão agora mede a **eficiência da equipe em converter reuniões realizadas em contratos pagos**, alinhando com a lógica já usada para Closers.
