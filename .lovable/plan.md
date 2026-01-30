
# Plano: Sincronizar Métricas "Fora do Carrinho" com KPIs

## Problema Identificado

| Fonte | Valor | Lógica |
|-------|-------|--------|
| **KPI "Fora do Carrinho"** | 6 | Conta attendees com `r2_status_id` IN (Reembolso, Desistente, Reprovado, etc.) |
| **Métricas "Reembolsos"** | 0 | Calcula `reprovados + desistentes` (linha 395) |

### Causas Raiz

1. **Cálculo errado**: O campo "Reembolsos" nas métricas usa `reprovados + desistentes`, não conta o status "Reembolso" real

2. **Filtro de reuniões diferente**: 
   - Métricas exclui `(cancelled, rescheduled)`
   - KPIs/Fora do Carrinho NÃO exclui

3. **Status "Reembolso" não é contado**: No loop de contagem (linhas 228-249), não há verificação para `statusName.includes('reembolso')`

---

## Solução Proposta

### Modificação em `useR2MetricsData.ts`

1. **Adicionar contador separado para Reembolsos reais**
2. **Ajustar o filtro para incluir reuniões rescheduled** (manter exclusão apenas de cancelled)
3. **Contar attendees com `r2_status_id = Reembolso`**

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useR2MetricsData.ts` | Corrigir contagem de Reembolsos e filtro de reuniões |

---

## Detalhes Técnicos

### Mudança 1: Ajustar filtro de reuniões (linha 80)

**Antes:**
```typescript
.not('status', 'in', '(cancelled,rescheduled)');
```

**Depois:**
```typescript
.not('status', 'eq', 'cancelled');
```

### Mudança 2: Adicionar contador de reembolsos (no loop de contagem)

**Antes (linhas 228-249):**
```typescript
if (statusName.includes('desistente')) {
  desistentes++;
} else if (statusName.includes('reprovado')) {
  reprovados++;
} else if (statusName.includes('próxima semana') || ...) {
  proximaSemana++;
} else if (statusName.includes('aprovado') || ...) {
  aprovados++;
  // ...
}
```

**Depois:**
```typescript
// Inicializar contador
let reembolsosCount = 0;

// No loop:
if (statusName.includes('desistente')) {
  desistentes++;
} else if (statusName.includes('reembolso')) {
  reembolsosCount++;
} else if (statusName.includes('reprovado')) {
  reprovados++;
} else if (statusName.includes('próxima semana') || ...) {
  proximaSemana++;
} else if (statusName.includes('aprovado') || ...) {
  aprovados++;
  // ...
}
```

### Mudança 3: Ajustar retorno (linhas 393-395)

**Antes:**
```typescript
const reembolsos = reprovados + desistentes;
```

**Depois:**
```typescript
// Usar o contador real de reembolsos
// (não somar reprovados+desistentes)
```

### Mudança 4: Ajustar cálculo de leads perdidos (linha 399)

**Antes:**
```typescript
const leadsPerdidosCount = desistentes + reprovados + proximaSemana + noShow;
```

**Depois:**
```typescript
const leadsPerdidosCount = desistentes + reprovados + reembolsosCount + proximaSemana + noShow;
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Reembolsos | 0 (reprovados+desistentes) | 6 (contagem real do status) |
| Desistentes | Correto | Mantido |
| Reprovados | Correto | Mantido |

---

## Validação

Os números das métricas devem agora corresponder aos KPIs:
- **Fora do Carrinho (KPI)**: 6
- **Reembolsos (Métricas)**: 6
