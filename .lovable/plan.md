
# Corrigir Atualização Automática de "Contrato Pago" e Jornada do Lead

## Problemas Identificados

### 1. Webhook Falha ao Marcar Contrato Pago
**Causa raiz:** O webhook `hubla-webhook-handler` tenta atualizar uma coluna `contract_paid_at` que **não existe** na tabela `meeting_slot_attendees`:

```
ERROR: Could not find the 'contract_paid_at' column of 'meeting_slot_attendees' in the schema cache
```

O código atual faz:
```typescript
.update({
  status: 'contract_paid',
  contract_paid_at: meeting.scheduled_at // ← COLUNA NÃO EXISTE!
})
```

**Resultado:** A atualização falha silenciosamente, e nenhum attendee é marcado como `contract_paid`.

### 2. Jornada do Lead Mostra Closer Errado (R2 no lugar de R1)
**Causa raiz:** O hook `useIncorporadorLeadJourney` busca reuniões diretamente da tabela `meeting_slots` via `meeting_slots.deal_id`:

```typescript
const { data: meetings } = await supabase
  .from('meeting_slots')
  .select(...)
  .eq('deal_id', deal.id) // ← ERRADO! meeting_slots.deal_id não é confiável
```

**O problema:** `meeting_slots.deal_id` aponta para o deal "principal" do slot (o primeiro lead agendado), mas slots são COMPARTILHADOS entre múltiplos leads. O vínculo correto está em `meeting_slot_attendees.deal_id`.

Exemplo real encontrado:
- Slot R1 do Julio: `deal_id = 1a492e2f...` (deal do Steeve, não do Christino)
- Slot R2 da Claudia: `deal_id = 3367a1c3...` (deal do Christino)

Quando o sistema busca reuniões do Christino via `meeting_slots.deal_id`, **não encontra a R1** (porque o slot aponta para outro deal), mas encontra a R2. Isso faz parecer que a R2 é a R1.

### 3. Separação R1/R2 Usa Campo Errado
O hook separa as reuniões assim:
```typescript
const meeting01Data = meetings?.find(m => m.lead_type !== 'R2');
const meeting02Data = meetings?.find(m => m.lead_type === 'R2');
```

Mas o campo correto é `meeting_type` (valores: `r1`, `r2`), não `lead_type` (que é tipo de lead: A, B, C, R2).

---

## Solução

### Parte 1: Criar Coluna Faltante (SQL)
Adicionar a coluna `contract_paid_at` na tabela `meeting_slot_attendees`:

```sql
ALTER TABLE meeting_slot_attendees 
ADD COLUMN IF NOT EXISTS contract_paid_at TIMESTAMPTZ;
```

### Parte 2: Corrigir Hook `useIncorporadorLeadJourney`
Modificar para buscar reuniões via `meeting_slot_attendees` (igual ao `useLeadJourney` do Kanban):

**Antes (errado):**
```typescript
const { data: meetings } = await supabase
  .from('meeting_slots')
  .select(...)
  .eq('deal_id', deal.id)
```

**Depois (correto):**
```typescript
const { data: attendees } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    id,
    status,
    meeting_slots!inner(
      id,
      scheduled_at,
      status,
      meeting_type,
      closer:closers(id, name, email)
    )
  `)
  .eq('deal_id', deal.id)
  .order('created_at', { ascending: false });

// Separar por meeting_type
const r1Attendee = attendees?.find(a => a.meeting_slots?.meeting_type === 'r1');
const r2Attendee = attendees?.find(a => a.meeting_slots?.meeting_type === 'r2');
```

### Parte 3: Reprocessar Pagamentos Pendentes
Executar o edge function `reprocess-contract-payments` para marcar os contratos já pagos (Steeve, Christino, etc.) que não foram processados devido ao erro.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| **SQL (Supabase)** | Adicionar coluna `contract_paid_at` |
| `src/hooks/useIncorporadorLeadJourney.ts` | Buscar via `meeting_slot_attendees` + usar `meeting_type` |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Webhook de contrato pago | Erro silencioso | Marca attendee corretamente |
| Jornada do Christino | Mostra R1 com Claudia | Mostra R1 com Julio, R2 com Claudia |
| Jornada do Steeve | Mostra R1 com closer errado | Mostra R1 com Julio, R2 com Jessica |

---

## Sequência de Implementação

1. **Primeiro:** Executar SQL para criar coluna `contract_paid_at`
2. **Segundo:** Corrigir hook `useIncorporadorLeadJourney`
3. **Terceiro:** Chamar endpoint `/reprocess-contract-payments` para marcar pagamentos pendentes
