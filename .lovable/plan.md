
# Plano: Corrigir Bugs do Painel Comercial

## Problemas Identificados

### Bug 1: GoalsPanel usa fontes diferentes dos KPIs principais
**Impacto: Alto**

O `GoalsPanel` (Metas da Equipe) usa hooks separados (`useMeetingSlotsKPIs`, `useR2MeetingSlotsKPIs`) que **nao filtram por SDR_LIST**, enquanto os `TeamKPICards` e a tabela SDR usam dados da RPC que **filtram por SDR_LIST**.

| Fonte | Filtro SDR_LIST | R1 Agendada (Total) | R1 Agendada (SDR_LIST) |
|-------|-----------------|---------------------|------------------------|
| GoalsPanel | Nao | 178 | - |
| TeamKPIs/Tabela | Sim | - | 159 |

**Diferenca:** 19 reunioes de SDRs fora da lista (Thaynar, Julio, Cristiane, etc.)

### Bug 2: Status 'refunded' inconsistente
**Impacto: Baixo**

A RPC `get_sdr_metrics_from_agenda` inclui `refunded` como `r1_realizada`, mas `useMeetingSlotsKPIs` nao inclui.

### Bug 3: useR2MeetingSlotsKPIs conta slots em vez de attendees
**Impacto: Medio**

O hook busca dados de `meeting_slots` (1 registro por reuniao), mas alguns slots R2 tem multiplos attendees. Isso causa subcontagem.

| Fonte | R2 Agendadas | R2 Realizadas |
|-------|--------------|---------------|
| meeting_slots | 23 | 10 |
| meeting_slot_attendees | 24 | 11 |

---

## Solucao Proposta

### Parte 1: Unificar fonte de dados para GoalsPanel

Modificar `ReunioesEquipe.tsx` para usar os dados ja filtrados de `teamKPIs` em vez de hooks separados.

**Arquivo:** `src/pages/crm/ReunioesEquipe.tsx`

**Antes (linhas 295-304):**
```typescript
const dayValues = useMemo(() => ({
  agendamento: dayKPIs?.totalAgendamentos || 0,
  r1Agendada: dayAgendaKPIs?.totalAgendadas || 0,    // BUG: nao filtra SDR_LIST
  r1Realizada: dayAgendaKPIs?.totalRealizadas || 0,  // BUG: nao filtra SDR_LIST
  noShow: dayAgendaKPIs?.totalNoShows || 0,          // BUG: nao filtra SDR_LIST
  ...
}), ...);
```

**Depois:**
```typescript
const dayValues = useMemo(() => ({
  agendamento: dayKPIs?.totalAgendamentos || 0,
  r1Agendada: dayKPIs?.totalRealizadas + dayKPIs?.totalNoShows + dayPendentes,  // CORRIGIDO
  r1Realizada: dayKPIs?.totalRealizadas || 0,        // CORRIGIDO
  noShow: dayKPIs?.totalNoShows || 0,                // CORRIGIDO
  ...
}), ...);
```

Alternativa mais limpa: Criar novos campos na RPC para retornar totais de R1 Agendada.

### Parte 2: Adicionar 'refunded' ao useMeetingSlotsKPIs

**Arquivo:** `src/hooks/useMeetingSlotsKPIs.ts`

**Alteracao (linha 44-46):**
```typescript
// ANTES
const totalRealizadas = attendees.filter(
  (a) => a.status === "completed" || a.status === "contract_paid"
).length;

// DEPOIS
const totalRealizadas = attendees.filter(
  (a) => a.status === "completed" || a.status === "contract_paid" || a.status === "refunded"
).length;
```

### Parte 3: Corrigir useR2MeetingSlotsKPIs para contar attendees

**Arquivo:** `src/hooks/useR2MeetingSlotsKPIs.ts`

**Antes:**
```typescript
const { data, error } = await supabase
  .from("meeting_slots")
  .select("id, status")
  .eq("meeting_type", "r2")
  ...
```

**Depois:**
```typescript
const { data, error } = await supabase
  .from("meeting_slot_attendees")
  .select(`
    status,
    meeting_slot:meeting_slots!inner(scheduled_at, meeting_type)
  `)
  .eq("meeting_slot.meeting_type", "r2")
  ...
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/crm/ReunioesEquipe.tsx` | Unificar fonte de dados do GoalsPanel |
| `src/hooks/useMeetingSlotsKPIs.ts` | Adicionar status 'refunded' |
| `src/hooks/useR2MeetingSlotsKPIs.ts` | Usar meeting_slot_attendees em vez de meeting_slots |

---

## Resultado Esperado

- GoalsPanel e TeamKPICards mostrarao os mesmos numeros
- Todos os lugares contarao 'refunded' como realizada
- R2 agendadas/realizadas contarao corretamente multiplos attendees
- Numeros consistentes em toda a interface
