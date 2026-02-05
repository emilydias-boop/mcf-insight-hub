
# Plano: Corrigir Atribuição de Closer R1 para Leads Remanejados

## Problema Identificado

Quando um lead com "Contrato Pago" é remanejado para outro closer, o sistema continua mostrando o closer original (onde o contrato foi pago) em vez do closer atual (para onde foi movido).

**Exemplo:** Eduardo Spadaro
- Pagou contrato na R1 do Julio (29/01)
- Foi remanejado para Cristiane Gomes (04/02)
- Sistema mostra "Julio" como Closer R1, mas deveria mostrar "Cristiane Gomes"

---

## Solução

Alterar a lógica do `useR2PendingLeads` para buscar o **closer mais recente** do lead, não apenas o closer da reunião onde o contrato foi pago.

---

## Alterações Técnicas

### Arquivo: `src/hooks/useR2PendingLeads.ts`

**Lógica atual:**
```
Busca attendee com status = 'contract_paid'
     ↓
Retorna closer desse attendee
```

**Nova lógica:**
```
Busca attendee com status = 'contract_paid'
     ↓
Busca TODOS attendees do mesmo contato/deal
     ↓
Identifica o mais recente (por scheduled_at)
     ↓
Retorna closer do attendee mais recente
```

**Alterações no código:**

1. Após buscar os attendees com `contract_paid`, fazer uma segunda query para buscar o **attendee mais recente** de cada contato/deal

2. Criar um mapa `contactId -> latestCloser` com o closer da reunião mais recente

3. Enriquecer os dados retornados com `latest_closer` em vez de usar apenas `meeting_slot.closer`

4. Atualizar a interface `R2PendingLead` para incluir o campo do closer mais recente

---

## Código Proposto

```typescript
// Após Step 6, antes de retornar pendingLeads:

// Step 7: Para cada lead pendente, buscar o closer mais recente
const dealIds = pendingLeads
  .filter(a => a.deal_id)
  .map(a => a.deal_id);

const { data: latestAttendees } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    deal_id,
    meeting_slot:meeting_slots!inner(
      scheduled_at,
      meeting_type,
      closer:closers(id, name)
    )
  `)
  .in('deal_id', dealIds)
  .eq('meeting_slots.meeting_type', 'r1')
  .order('meeting_slots.scheduled_at', { ascending: false });

// Criar mapa: deal_id -> closer mais recente
const latestCloserMap = new Map();
latestAttendees?.forEach(att => {
  if (!latestCloserMap.has(att.deal_id)) {
    latestCloserMap.set(att.deal_id, att.meeting_slot?.closer);
  }
});

// Enriquecer pendingLeads com closer mais recente
return pendingLeads.map(lead => ({
  ...lead,
  meeting_slot: {
    ...lead.meeting_slot,
    closer: latestCloserMap.get(lead.deal_id) || lead.meeting_slot?.closer
  }
}));
```

---

## Resultado Esperado

Após a alteração, o Eduardo Spadaro aparecerá com:
- **Closer R1: Cristiane Gomes** (reunião mais recente em 04/02)
- Em vez de Julio (reunião original com contrato pago em 29/01)

---

## Impacto

Esta alteração afeta apenas a **exibição** na aba "Pendentes". A atribuição do contrato e métricas financeiras continuam baseadas no registro original de `contract_paid`.
