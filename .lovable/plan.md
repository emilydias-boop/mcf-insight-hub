

# Correção: Atribuir SDR via `booked_by` em vez de `owner_profile_id`

## Problema

Quando um SDR agenda uma R1 e depois o lead é transferido para o closer, o `crm_deals.owner_profile_id` muda para o closer. O relatório usa esse campo para identificar o SDR, resultando em 127 transações "Sem SDR" que na verdade tinham um SDR responsável original.

## Solução

Usar `meeting_slots.booked_by` (UUID do SDR que agendou a R1) como fonte primária de atribuição do SDR, em vez de `crm_deals.owner_profile_id`. Isso é consistente com a lógica já usada nos relatórios de R2.

## Alterações

### Arquivo: `src/hooks/useAcquisitionReport.ts`

**1. Atualizar interface `AttendeeWithSDR`** -- adicionar `booked_by` no tipo de `meeting_slots`:

```typescript
meeting_slots: { 
  closer_id: string | null; 
  scheduled_at: string | null;
  booked_by: string | null;  // <-- novo
} | null;
```

**2. Atualizar query de attendees (passo 4)** -- incluir `booked_by` no select:

```text
// Antes:
meeting_slots!inner(closer_id, scheduled_at)

// Depois:
meeting_slots!inner(closer_id, scheduled_at, booked_by)
```

**3. Atualizar classificação (passo 8)** -- usar `booked_by` como fonte primária do SDR:

```text
// Antes:
const rawSdrId = matchedAttendee?.crm_deals?.owner_profile_id || null;

// Depois:
const rawSdrId = matchedAttendee?.meeting_slots?.booked_by 
  || matchedAttendee?.crm_deals?.owner_profile_id 
  || null;
```

Isso faz fallback para `owner_profile_id` caso `booked_by` esteja nulo (dados antigos), mas prioriza o SDR que realmente agendou a reunião.

## Resultado

- Transações cujo lead foi transferido do SDR para o closer serão corretamente atribuídas ao SDR original
- O numero de "Sem SDR" cairá significativamente (de ~127 para apenas as transações sem match na agenda ou de origens automáticas)
- Consistente com a lógica de atribuição já usada nos relatórios de R2

