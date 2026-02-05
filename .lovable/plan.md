
# Plano: Corrigir Ordenacao do Closer R1 Mais Recente

## Problema

A query do Supabase com `.order('meeting_slots(scheduled_at)')` nao esta ordenando corretamente os resultados aninhados. A ordenacao por campos de relacionamentos no Supabase client tem limitacoes.

## Solucao

Ordenar os resultados no JavaScript apos recebe-los, em vez de confiar na ordenacao do Supabase.

---

## Alteracao

### Arquivo: `src/hooks/useR2PendingLeads.ts`

Modificar o Step 7 para ordenar os dados localmente:

**Antes (linhas 236-243):**
```typescript
// Create map: deal_id -> most recent closer
const latestCloserMap = new Map<string, { id: string; name: string } | null>();
((latestAttendees as any[]) || []).forEach(att => {
  if (att.deal_id && !latestCloserMap.has(att.deal_id)) {
    const slot = Array.isArray(att.meeting_slot) ? att.meeting_slot[0] : att.meeting_slot;
    latestCloserMap.set(att.deal_id, slot?.closer || null);
  }
});
```

**Depois:**
```typescript
// Sort attendees by scheduled_at DESC (client-side) since Supabase nested ordering is unreliable
const sortedAttendees = ((latestAttendees as any[]) || [])
  .map(att => {
    const slot = Array.isArray(att.meeting_slot) ? att.meeting_slot[0] : att.meeting_slot;
    return {
      deal_id: att.deal_id,
      scheduled_at: slot?.scheduled_at,
      closer: slot?.closer
    };
  })
  .sort((a, b) => {
    if (!a.scheduled_at || !b.scheduled_at) return 0;
    return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
  });

// Create map: deal_id -> most recent closer
const latestCloserMap = new Map<string, { id: string; name: string } | null>();
sortedAttendees.forEach(att => {
  if (att.deal_id && !latestCloserMap.has(att.deal_id)) {
    latestCloserMap.set(att.deal_id, att.closer || null);
  }
});
```

---

## Resultado Esperado

Eduardo Spadaro aparecera com **Cristiane Gomes** como Closer R1 (reuniao mais recente em 04/02), em vez de Julio.
