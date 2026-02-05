
# Plano: Deduplicar Leads Pendentes por Contact ID

## Problema Identificado

Eduardo Spadaro aparece duas vezes na lista:
- R1: 04/02 às 19:00 (Mateus Macedo) - registro mais recente
- R1: 29/01 às 18:00 (Julio) - registro antigo

Ambos os registros têm status `contract_paid`, mas representam o **mesmo contato**. A lista deveria mostrar apenas o mais recente.

## Solução

Adicionar um passo de deduplicação por `contact_id` após o Step 6, antes de aplicar o Step 7.

---

## Alterações

### Arquivo: `src/hooks/useR2PendingLeads.ts`

#### Adicionar Step 6.5: Deduplicar por contact_id (após linha 214)

```typescript
// Step 6.5: Deduplicate by contact_id, keeping the most recent meeting
const seenContacts = new Map<string, R2PendingLead>();
const deduplicatedLeads: R2PendingLead[] = [];

pendingLeads.forEach(lead => {
  // Use contact_id as primary key, fallback to normalized_name or normalized_phone
  const dedupeKey = lead.contact_id 
    || lead.normalized_name 
    || lead.normalized_phone 
    || lead.id; // fallback to unique id if no correlation
  
  const existing = seenContacts.get(dedupeKey);
  
  if (!existing) {
    seenContacts.set(dedupeKey, lead);
    return;
  }
  
  // Keep the one with the most recent meeting
  const existingDate = existing.meeting_slot?.scheduled_at 
    ? new Date(existing.meeting_slot.scheduled_at).getTime() 
    : 0;
  const currentDate = lead.meeting_slot?.scheduled_at 
    ? new Date(lead.meeting_slot.scheduled_at).getTime() 
    : 0;
  
  if (currentDate > existingDate) {
    seenContacts.set(dedupeKey, lead);
  }
});

const uniquePendingLeads = Array.from(seenContacts.values());
```

#### Atualizar referências ao `pendingLeads` no Step 7

Substituir todas as referências a `pendingLeads` por `uniquePendingLeads` no Step 7 e no retorno final.

---

## Fluxo de Dados Corrigido

```text
Eduardo Spadaro (contact_id: X)
    |
    +-- R1 Julio (29/01, contract_paid)
    +-- R1 Mateus (04/02, contract_paid)  <-- mais recente
    |
    V
Step 6: Ambos passam (nenhum tem R2)
    |
    V
Step 6.5 (NOVO): Deduplica por contact_id
    - Mantém apenas Mateus (04/02) pois é mais recente
    |
    V
Step 7: Enriquece com closer mais recente
    |
    V
Lista final: Eduardo aparece 1x com Mateus
```

---

## Resultado Esperado

- Eduardo Spadaro aparecerá **apenas uma vez** na lista
- Será mostrada a R1 mais recente (04/02 às 19:00 com Mateus Macedo)
- O contador "46 pendentes" será atualizado para refletir leads únicos
