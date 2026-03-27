

## Problema: 31 leads "Sem cadastro no carrinho"

### Causa raiz

A logica atual do hook `useCarrinhoAnalysisReport.ts` busca transacoes em `hubla_transactions` e tenta vincular a um `meeting_slot_attendee` de duas formas:

1. Via `linked_attendee_id` (campo na transacao) — muitos sao `NULL`
2. Via email → `crm_contacts.email` → `contact_id` no attendee

Se nenhuma das duas encontra um attendee, classifica como **"Sem cadastro no carrinho"**. Os 31 leads caem nesse buraco por:

- **`linked_attendee_id` nao foi preenchido** (a vinculacao manual nao foi feita)
- **Email nao bate** (email diferente entre Hubla e CRM, ou contato nao existe no CRM)
- **Nao busca por telefone** — a terceira via de matching que existe em outros hooks do sistema (ex: `useR2MetricsData`) nao esta implementada aqui
- **Nao filtra por `meeting_type = 'r2'`** — pode encontrar attendees de R1 e ignorar os de R2

### Correcoes

**1. `src/hooks/useCarrinhoAnalysisReport.ts`**
- Adicionar matching por **telefone** (ultimos 9 digitos, mesmo padrao dos outros hooks)
- Ao buscar attendees por `contact_id`, filtrar apenas attendees com `meeting_slot.meeting_type = 'r2'`
- Ao buscar attendees por `linked_attendee_id`, tambem verificar se e R2
- Adicionar fallback: buscar `meeting_slot_attendees` diretamente por `attendee_phone` (ultimos 9 digitos) quando email e linked_id falham
- Deduplicar attendees por deal_id (manter o mais recente de R2)

**2. Melhoria na classificacao**
- "Sem cadastro no carrinho" so deve aparecer quando o lead genuinamente nao tem nenhum attendee R2 por nenhuma via de matching
- Adicionar sub-motivo "Sem contato no CRM" vs "Contato existe mas sem R2" para diferenciar

### Resultado esperado
Os 31 leads devem cair significativamente — os que tiverem attendee R2 vinculavel por telefone serao reclassificados para o motivo correto (agendado, no-show, etc.). Os que sobrarem sao genuinamente leads que nao entraram no fluxo de carrinho.

