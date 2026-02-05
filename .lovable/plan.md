
# Plano: Corrigir Extração do Closer no Array

## Problema Identificado

O código atual não está tratando o caso onde o `closer` pode ser retornado como array pelo Supabase client (similar ao `meeting_slot`):

```typescript
// Linha 246 atual:
closer: slot?.closer  // <- Pode ser array!
```

## Solução

Adicionar tratamento para array no objeto `closer`, similar ao que já fazemos com `meeting_slot`.

---

## Alteração

### Arquivo: `src/hooks/useR2PendingLeads.ts`

**Antes (linha 246):**
```typescript
closer: slot?.closer
```

**Depois:**
```typescript
closer: Array.isArray(slot?.closer) ? slot?.closer[0] : slot?.closer
```

---

## Código Completo do Trecho (linhas 240-252)

```typescript
const sortedAttendees = ((latestAttendees as any[]) || [])
  .map(att => {
    const slot = Array.isArray(att.meeting_slot) ? att.meeting_slot[0] : att.meeting_slot;
    const closer = Array.isArray(slot?.closer) ? slot?.closer[0] : slot?.closer;
    return {
      deal_id: att.deal_id,
      scheduled_at: slot?.scheduled_at,
      closer: closer
    };
  })
  .sort((a, b) => {
    if (!a.scheduled_at || !b.scheduled_at) return 0;
    return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
  });
```

---

## Resultado Esperado

Eduardo Spadaro aparecerá com **Cristiane Gomes** como Closer R1 (reunião mais recente em 04/02/2026).
