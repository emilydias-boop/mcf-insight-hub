
# Plano: Corrigir Contagem de Aprovados no Carrinho R2

## Problema Identificado

A KPI de "Aprovados" mostra **53**, mas a aba de Aprovados lista apenas **51** leads.

### Causa Raiz

Os **2 leads faltantes** são:
1. **Juliano Locatelli** (Jessica Bellini, 29/01)
2. **Victor Hugo Lima Silva** (Claudia Carielo, 27/01)

Ambos têm:
- `r2_status_id` = **Aprovado** ✓
- `meeting_status` = **rescheduled** (reunião reagendada)

### Comportamento Atual

| Componente | Conta reuniões reagendadas? |
|------------|----------------------------|
| **KPI** (useR2CarrinhoKPIs.ts) | SIM - conta todos com r2_status = Aprovado |
| **Lista** (useR2CarrinhoData.ts) | NÃO - exclui meeting_status = rescheduled |

Código problemático em `useR2CarrinhoData.ts` (linha 100-101):
```typescript
if (filter === 'aprovados') {
  query = query.not('status', 'in', '(cancelled,rescheduled)');
}
```

---

## Solução Proposta

**Remover `rescheduled` do filtro de exclusão na aba "Aprovados"**, mantendo apenas a exclusão de `cancelled`.

### Justificativa

Um lead que foi **aprovado** na R2 original permanece aprovado mesmo se a reunião foi reagendada. O status de aprovação é do **lead**, não da reunião.

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useR2CarrinhoData.ts` | Alterar filtro da aba "aprovados" para excluir apenas `cancelled` |

---

## Detalhes Técnicos

### Antes:
```typescript
} else if (filter === 'aprovados') {
  // For aprovados, include completed AND scheduled meetings (exclude only cancelled/rescheduled)
  query = query.not('status', 'in', '(cancelled,rescheduled)');
}
```

### Depois:
```typescript
} else if (filter === 'aprovados') {
  // For aprovados, include all meetings except cancelled
  // Rescheduled meetings should still show if attendee was approved
  query = query.not('status', 'eq', 'cancelled');
}
```

---

## Resultado Esperado

- KPI de Aprovados: **53**
- Lista de Aprovados: **53** (agora inclui Juliano Locatelli e Victor Hugo)
- Busca por "Juliano Locatelli" retorna resultado na aba Aprovados

---

## Impacto em Outras Abas

A aba **"Todas R2s"** usa filtro `agendadas` que também exclui `rescheduled`. Isso pode precisar de análise separada se houver inconsistências similares.
