

# Plano: Sincronizar Métricas do Carrinho R2

## Problema Identificado

As métricas do Carrinho R2 estão inconsistentes entre diferentes componentes:

| Métrica | Valor | Esperado | Problema |
|---------|-------|----------|----------|
| **Aprovados (KPI)** | 50 | ✅ Correto | - |
| **Aprovados (Tab)** | 50 | ✅ Correto | - |
| **Selecionados** | 49 | 50 | Falta 1 lead |
| **No Carrinho** | 57 | 50 | +7 leads extras |

### Diagnóstico Técnico

1. **"Selecionados" = 49** (deveria ser 50):
   - Em `useR2MetricsData`, a lógica `else if` só conta "aprovados" se o lead NÃO for classificado antes como no-show, desistente, etc.
   - Se um lead estava como no-show e depois foi reagendado e aprovado, a lógica de prioridade pode manter `is_no_show = true` se o critério de substituição não for atendido

2. **"No Carrinho" = 57** (deveria ser 50):
   - O cálculo atual: `leadsAtivos = totalLeads - leadsPerdidosCount`
   - Isso inclui TODOS os leads que não são "perdidos", não apenas aprovados
   - Inclui: Aprovados + Leads sem status + Leads "Em Análise"

### A Confusão

| Métrica | Significado Atual | Significado Esperado |
|---------|-------------------|----------------------|
| **No Carrinho** | Total de leads menos perdidos (inclui pendentes) | Leads aprovados ativos |
| **Selecionados** | Aprovados (contagem com bug) | Aprovados |

---

## Solução Proposta

### Opção 1: Renomear para Clareza (Recomendada)

Manter as duas métricas com nomes mais claros:

| Métrica | Nome Atual | Nome Novo | Descrição |
|---------|------------|-----------|-----------|
| `leadsAtivos` | No Carrinho | **Em Avaliação** | Total - Perdidos (inclui pendentes + aprovados) |
| `selecionados` | Selecionados | **Aprovados** | Apenas leads com status "Aprovado" |

### Opção 2: Corrigir "No Carrinho" para = Aprovados

Se "No Carrinho" deve significar **apenas aprovados**, então:
- `leadsAtivos = aprovados` (não `totalLeads - perdidos`)

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useR2MetricsData.ts` | Corrigir lógica de contagem de aprovados |
| `src/components/crm/R2MetricsPanel.tsx` | Ajustar exibição das métricas |

---

## Implementação Técnica

### 1. Corrigir contagem de "Aprovados/Selecionados"

O problema está na priorização do status. Quando um lead tem múltiplas reuniões:
- R2 #1: No-show
- R2 #2: Aprovado

A lógica atual pode manter `is_no_show = true` se a priorização não funcionar corretamente.

```typescript
// Ajustar prioridade: Aprovado deve sempre sobrescrever no-show
const statusPriority = (status: string): number => {
  if (status.includes('aprovado')) return 100;  // Maior prioridade
  if (status.includes('reprovado')) return 90;
  if (status.includes('desistente')) return 80;
  if (status.includes('reembolso')) return 70;
  if (status.includes('próxima semana')) return 60;
  return 0;
};

// Na comparação de leads:
const shouldReplace = !existing || 
  statusPriority(statusName) > statusPriority(existing.r2_status) ||
  (statusPriority(statusName) === statusPriority(existing.r2_status) && 
   new Date(meeting.scheduled_at) > new Date(existing.scheduled_at));
```

### 2. Ajustar métrica "No Carrinho"

Mudar para igualar aos aprovados (se esse for o objetivo):

```typescript
// ANTES
const leadsAtivos = totalLeads - leadsPerdidosCount;

// DEPOIS
const leadsAtivos = aprovados; // "No Carrinho" = Aprovados
```

**OU** renomear para "Em Avaliação" se quiser manter o conceito atual.

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Aprovados (KPI) | 50 | 50 |
| Aprovados (Tab) | 50 | 50 |
| Selecionados | 49 | 50 |
| No Carrinho | 57 | 50 |

Todas as métricas sincronizadas = **50 aprovados únicos**.

---

## Impacto

| Componente | Impacto |
|------------|---------|
| KPIs do Carrinho R2 | Sem mudança (já correto) |
| Tab "Aprovados" | Sem mudança (já correto) |
| Métricas Panel | ✅ Corrigido |
| Cálculo de Conversão | ✅ Usará base correta |

