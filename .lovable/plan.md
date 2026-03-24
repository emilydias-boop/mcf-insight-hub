

## Problema identificado

A consolidação de deals tem **2 bugs críticos**:

1. **`meeting_slot_attendees.deal_id` não é atualizado** — esta tabela tem sua própria coluna `deal_id` com `ON DELETE CASCADE`. Quando o deal secundário é deletado, os attendees vinculados a ele são **deletados em cascata**, perdendo dados de R1/R2 (notas de qualificação, status, etc.).

2. **`meeting_slots.deal_id` insuficiente** — O código atualiza `meeting_slots.deal_id`, mas o vínculo real das reuniões com o deal do Lucas está em `meeting_slot_attendees.deal_id`.

### Caso Lucas

O deal "Reunião 02 Realizada" tinha a R1 registrada via `meeting_slot_attendees`. Ao consolidar, o código:
- ✅ Transferiu `meeting_slots.deal_id` para o deal "Contrato Pago"
- ❌ **NÃO** transferiu `meeting_slot_attendees.deal_id`
- ❌ Ao deletar o deal secundário, os attendees foram **cascade-deleted**

### Correção

Adicionar transferência de `meeting_slot_attendees.deal_id` na função `consolidateDeals`, ANTES de deletar o deal secundário.

### Arquivo a alterar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/merge-duplicate-contacts/index.ts` | Na função `consolidateDeals`, adicionar `UPDATE meeting_slot_attendees SET deal_id = primaryDeal.id WHERE deal_id = secDeal.id` antes da deleção do deal secundário |

### Lógica atualizada

```text
Para cada deal secundário:
  1. UPDATE meeting_slots SET deal_id = primary WHERE deal_id = secondary
  2. UPDATE meeting_slot_attendees SET deal_id = primary WHERE deal_id = secondary  ← NOVO
  3. UPDATE deal_activities SET deal_id = primary WHERE deal_id = secondary
  4. UPDATE calls SET deal_id = primary WHERE deal_id = secondary
  5. Merge tags
  6. DELETE crm_deals WHERE id = secondary
```

### O que NÃO muda
- Lógica de seleção do primary (maior stage_order)
- Merge de contatos (email/phone/tags)
- Nenhum arquivo de frontend

