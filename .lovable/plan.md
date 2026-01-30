
# Plano: Corrigir Sincronização de Status Aprovado no Carrinho R2

## Problema Identificado

| Situação | Descrição |
|----------|-----------|
| **Lead** | Roberto Gomes Athayde - R2 realizada em 26/01 com Claudia Carielo |
| **Status no banco** | `r2_status_id = Aprovado` ✅ (verificado via query) |
| **Problema** | Lead não aparece na aba "Aprovados" do Carrinho R2 |
| **Causa raiz** | O hook `useUpdateR2Attendee` não invalida as queries do Carrinho |

## Diagnóstico Técnico

O hook `useUpdateR2Attendee` (usado pelo drawer de Avaliação R2) invalida apenas:
```typescript
queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
```

Mas as abas do Carrinho R2 usam queries diferentes:
- `r2-carrinho-data` (dados das abas)
- `r2-carrinho-kpis` (contadores superiores)

## Solução Proposta

Adicionar invalidação das queries do Carrinho R2 ao hook `useUpdateR2Attendee`.

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useR2AttendeeUpdate.ts` | Adicionar invalidação de `r2-carrinho-data` e `r2-carrinho-kpis` |

---

## Implementação Técnica

### Mudança em useR2AttendeeUpdate.ts

**Antes (linhas 37-41):**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
  queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
  toast.success('Atualizado');
},
```

**Depois:**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
  queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
  queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
  queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
  queryClient.invalidateQueries({ queryKey: ['r2-fora-carrinho-data'] });
  toast.success('Atualizado');
},
```

Também aplicar a mesma correção em todas as funções do arquivo:
- `useBatchUpdateR2Attendees` (linha 66-69)
- `useQuickUpdateAttendeeStatus` (linha 93-95)
- `useRemoveR2Attendee` (linha 116-119)
- `useCancelR2Meeting` (linha 149-152)
- `useRestoreR2Meeting` (linha 174-176)

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Marcar "Aprovado" não atualiza Carrinho R2 | Carrinho R2 atualiza automaticamente |
| KPI "Aprovados" não incrementa | KPI incrementa imediatamente (46 → 47) |
| Lead não aparece na aba "Aprovados" | Lead aparece instantaneamente |
| Requer refresh manual da página | Tudo sincronizado sem refresh |

---

## Impacto

Esta correção garante que qualquer alteração de status R2 (Aprovado, Reprovado, Desistente, etc.) seja refletida imediatamente em:
- KPIs do Carrinho R2 (contadores superiores)
- Aba "Todas R2s"
- Aba "Aprovados"
- Aba "Fora do Carrinho"
- Métricas gerais
