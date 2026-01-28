
# Corrigir Matching de "Contrato Pago" para Priorizar R1

## Problema Identificado
O `reprocess-contract-payments` não filtra por `meeting_type = 'r1'`, então ao encontrar múltiplos attendees (R1 e R2) para o mesmo lead, ele marca o **mais recente** (R2) em vez da **R1 original** onde o contrato foi fechado.

### Situação Atual no Banco
| Lead | R1 (Julio, 27/01) | R2 (29-30/01) |
|------|-------------------|---------------|
| Steeve Wallace | `invited` ❌ | `contract_paid` |
| Christino Trigueiro | `invited` ❌ | `contract_paid` |

## Solução

### Parte 1: Corrigir Edge Function `reprocess-contract-payments`
Adicionar filtro por `meeting_type = 'r1'` na busca de attendees (igual ao `hubla-webhook-handler`):

```typescript
// ANTES (linha ~101-105)
const { data: attendees } = await supabase
  .from('meeting_slot_attendees')
  .select(`..., slot:meeting_slots(...)`)
  .gte('created_at', fourteenDaysAgo.toISOString())
  .order('created_at', { ascending: false });

// DEPOIS
const { data: attendees } = await supabase
  .from('meeting_slot_attendees')
  .select(`..., slot:meeting_slots!inner(...)`)
  .eq('slot.meeting_type', 'r1')  // ← NOVO: filtrar apenas R1
  .gte('slot.scheduled_at', fourteenDaysAgo.toISOString())
  .in('slot.status', ['scheduled', 'completed', 'rescheduled', 'contract_paid'])
  .in('status', ['scheduled', 'invited', 'completed']);
```

### Parte 2: Corrigir Status dos Attendees Atuais (SQL)
Atualizar manualmente os attendees R1 que ficaram errados:

```sql
-- Steeve Wallace R1 com Julio
UPDATE meeting_slot_attendees 
SET status = 'contract_paid', updated_at = NOW()
WHERE id = '32c5cdd8-5174-482d-a416-436dc44e0207';

-- Christino Trigueiro R1 com Julio
UPDATE meeting_slot_attendees 
SET status = 'contract_paid', updated_at = NOW()
WHERE id = 'b4847fcb-f0d6-4216-a11c-e5be915eea1f';

-- Opcional: Reverter R2s para status anterior (já que contrato foi na R1)
UPDATE meeting_slot_attendees 
SET status = 'invited', updated_at = NOW()
WHERE id IN ('a6d74d87-5d0f-4694-bb9a-707e9983cd66', '8ff19f47-eca8-44be-a612-dfc0f02e8195');
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/reprocess-contract-payments/index.ts` | Adicionar filtro `meeting_type = 'r1'` e usar `!inner` join |
| **SQL direto** | Corrigir status dos 4 attendees (Steeve R1, Christino R1, e reverter R2s) |

---

## Resultado Esperado

### Após Correção
| Lead | R1 (Julio) | R2 |
|------|------------|-----|
| Steeve | `contract_paid` ✓ | `invited` |
| Christino | `contract_paid` ✓ | `invited` |

### Na Agenda
- 27/01 às 19:15 (Julio): Steeve e Christino mostrarão **CP** (Contrato Pago)
- R2s futuras: Mostrarão status correto de cada etapa

---

## Sequência de Implementação

1. Atualizar `reprocess-contract-payments` com filtro de R1
2. Executar SQL para corrigir os 4 attendees afetados
3. Validar na Agenda que os badges estão corretos
