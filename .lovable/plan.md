

## Corrigir formulas dos KPIs "Leads do Carrinho"

### Problema

Atualmente, `totalLeads` conta todos os attendees unicos (80), incluindo no-shows, desistentes, reembolsos, reprovados, etc. O usuario quer que as metricas reflitam:

- **Total Leads** = agendados (sem status definido, pendentes) + aprovados
- **No Carrinho** = aprovados
- **Desistentes** = desistentes
- **Reembolsos** = reembolsos
- **Reprovados** = reprovados
- **Proxima Semana** = proxima semana
- **No-Show** = no-show
- **Perdidos %** = (desistentes + reembolsos + reprovados) / total leads * 100 (sem no-show e sem proxima semana)

### Alteracao

**`src/hooks/useR2MetricsData.ts`**

1. **Linha 258** - Mudar calculo de `totalLeads`: em vez de `leadsByDeal.size`, calcular como a soma dos leads que estao "agendados" (sem status de perda/no-show) + aprovados. Ou seja, contar apenas leads cujo status final e "pendente/agendado" ou "aprovado".

2. **Linha 465** - Mudar formula de `leadsPerdidosPercent`:
   - Atual: `(desistentes + reprovados + reembolsos + proximaSemana + noShow) / totalLeads`
   - Nova: `(desistentes + reembolsos + reprovados) / totalLeads` (exclui no-show e proxima semana)

Concretamente, apos o loop que conta cada categoria (linhas 278-318), calcular:

```typescript
// Total Leads = agendados pendentes + aprovados (exclui no-show, desistentes, reembolsos, reprovados, proxima semana)
const agendadosPendentes = leadsByDeal.size - desistentes - reprovados - reembolsosCount - proximaSemana - noShow - aprovados;
const totalLeads = agendadosPendentes + aprovados;

// Perdidos % = (desistentes + reembolsos + reprovados) / totalLeads
const leadsPerdidosCount = desistentes + reprovados + reembolsosCount;
const leadsPerdidosPercent = totalLeads > 0 ? (leadsPerdidosCount / totalLeads) * 100 : 0;
```

### Resultado

Os cards mostrarao:
- **Total Leads**: apenas leads ativos (agendados pendentes + aprovados), sem contar perdidos/no-show
- **Perdidos %**: apenas desistentes + reembolsos + reprovados, sem no-show nem proxima semana

