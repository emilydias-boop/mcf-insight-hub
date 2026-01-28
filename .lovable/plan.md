
# Corrigir Métricas R1 no TeamGoalsPanel e KPI Cards

## Diagnóstico Confirmado

### Evidência do Banco de Dados (28/01/2026)
| meeting_type | status | total |
|--------------|--------|-------|
| **R1** | invited | 32 |
| **R1** | no_show | 3 |
| **R1** | completed | 1 |
| R2 | invited | 12 |
| R2 | contract_paid | 1 |

**Totais:**
- R1 apenas: **36 attendees** ← correto na agenda visual
- R1 + R2: **49 attendees** ← o que os hooks retornam

### Discrepância Identificada
| Métrica | UI mostra | Deveria ser | Causa |
|---------|-----------|-------------|-------|
| R1 Agendada (DIA) | 48 | 36 | Hook inclui R2 |
| Pendentes Hoje | 43 | 32 | Hook inclui R2 |

---

## Causa Raiz

### 1. `useMeetingSlotsKPIs.ts` (linhas 20-27)
```typescript
const { data, error } = await supabase
  .from("meeting_slot_attendees")
  .select(`status, meeting_slot:meeting_slots!inner(scheduled_at)`)
  .gte("meeting_slot.scheduled_at", startISO)
  .lte("meeting_slot.scheduled_at", endISO);
  // ❌ FALTA: .eq("meeting_slot.meeting_type", "r1")
```

### 2. `useMeetingsPendentesHoje.ts` (linhas 17-24)
```typescript
const { data, error } = await supabase
  .from("meeting_slot_attendees")
  .select(`status, meeting_slot:meeting_slots!inner(scheduled_at)`)
  .gte("meeting_slot.scheduled_at", startISO)
  .lte("meeting_slot.scheduled_at", endISO);
  // ❌ FALTA: .eq("meeting_slot.meeting_type", "r1")
```

---

## Solução

Adicionar filtro `meeting_type = 'r1'` em ambos os hooks para contar apenas reuniões R1.

### Arquivo 1: `src/hooks/useMeetingSlotsKPIs.ts`

**Mudança (linhas 20-27):**
```typescript
const { data, error } = await supabase
  .from("meeting_slot_attendees")
  .select(`
    status,
    meeting_slot:meeting_slots!inner(scheduled_at, meeting_type)
  `)
  .gte("meeting_slot.scheduled_at", startISO)
  .lte("meeting_slot.scheduled_at", endISO)
  .eq("meeting_slot.meeting_type", "r1"); // ← ADICIONAR
```

### Arquivo 2: `src/hooks/useMeetingsPendentesHoje.ts`

**Mudança (linhas 17-24):**
```typescript
const { data, error } = await supabase
  .from("meeting_slot_attendees")
  .select(`
    status,
    meeting_slot:meeting_slots!inner(scheduled_at, meeting_type)
  `)
  .gte("meeting_slot.scheduled_at", startISO)
  .lte("meeting_slot.scheduled_at", endISO)
  .eq("meeting_slot.meeting_type", "r1"); // ← ADICIONAR
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| R1 Agendada (DIA) | 48 | 36 |
| Pendentes Hoje | 43 | 32 |
| Agenda R1 | 36 | 36 ✓ Bate |

### Comportamento Corrigido
- "R1 Agendada" no TeamGoalsPanel contará apenas reuniões R1
- "Pendentes Hoje" nos KPI Cards contará apenas R1 pendentes
- Métricas R2 continuam separadas nos seus próprios hooks (`useR2MeetingSlotsKPIs`)

---

## Arquivos a Modificar

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `src/hooks/useMeetingSlotsKPIs.ts` | Adicionar `.eq("meeting_slot.meeting_type", "r1")` | R1 Agendada, Realizada, No-Show corretos |
| `src/hooks/useMeetingsPendentesHoje.ts` | Adicionar `.eq("meeting_slot.meeting_type", "r1")` | Pendentes Hoje correto |

---

## Resumo

**Problema**: Hooks R1 incluíam attendees de R2, inflando métricas (48 vs 36).

**Solução**: Filtrar por `meeting_type = 'r1'` nas queries.

**Risco**: Baixo (apenas corrige contagem, não altera dados).
