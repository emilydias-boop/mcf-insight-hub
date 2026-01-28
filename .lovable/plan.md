

# Corrigir Invalidação de Cache para Leads Pendentes R2

## Problema Identificado

Quando um lead é agendado para R2 via o modal `R2QuickScheduleModal`, a lista de "Pendentes" não atualiza porque o hook `useCreateR2Meeting` **não invalida** a query `r2-pending-leads`.

### Fluxo Atual (Problema)

```text
Usuário clica "Agendar R2" → useCreateR2Meeting.mutate() → 
  ✅ Cria meeting_slot (tipo r2)
  ✅ Cria meeting_slot_attendee (com deal_id)
  ✅ Invalida ['r2-agenda-meetings']
  ✅ Invalida ['r2-meetings-extended']
  ❌ NÃO invalida ['r2-pending-leads'] ← CAUSA RAIZ
  
→ Lista Pendentes continua mostrando lead já agendado
```

### Evidência no Código

**`src/hooks/useR2AgendaData.ts` (linhas 336-339):**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
  queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
  // ❌ FALTA: queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
  toast.success('Reunião R2 agendada com sucesso');
},
```

---

## Solução

Adicionar invalidação da query `r2-pending-leads` em **todos os hooks** que podem afetar a lista de pendentes.

### Arquivo: `src/hooks/useR2AgendaData.ts`

#### Mudança 1: `useCreateR2Meeting` (linha 336-339)

**De:**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
  queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
  toast.success('Reunião R2 agendada com sucesso');
},
```

**Para:**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
  queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
  queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] }); // ← ADICIONAR
  toast.success('Reunião R2 agendada com sucesso');
},
```

#### Mudança 2: `useRescheduleR2Meeting` (linha 241-244)

**Adicionar** invalidação de pending-leads:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
  queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
  queryClient.invalidateQueries({ queryKey: ['r2-noshows'] });
  queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] }); // ← ADICIONAR
  toast.success('Reunião R2 reagendada');
},
```

---

## Resultado Esperado

| Ação | Antes | Depois |
|------|-------|--------|
| Agendar R2 via modal | Lista Pendentes não atualiza | Lista Pendentes remove o lead |
| Reagendar R2 | Lista Pendentes desatualizada | Lista atualizada corretamente |
| Contagem na aba | Mantém número antigo | Reduz automaticamente |

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useR2AgendaData.ts` | Adicionar invalidação de `r2-pending-leads` nos hooks `useCreateR2Meeting` e `useRescheduleR2Meeting` |

---

## Resumo Técnico

- **Problema**: Cache `r2-pending-leads` não era invalidado após criar/reagendar R2
- **Solução**: Adicionar `queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] })` nos callbacks `onSuccess`
- **Impacto**: Lista de pendentes atualiza automaticamente após agendamentos
- **Risco**: Nenhum (apenas adiciona invalidação de cache)

