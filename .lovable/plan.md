

# Plano: Corrigir Performance do Webhook Make Contrato

## Problema Identificado

O webhook `webhook-make-contrato` está dando **timeout** porque a função `autoMarkContractPaid` está fazendo **centenas de queries individuais** ao banco de dados.

### Causa Raiz

No loop de matching (linhas 102-137), para **cada um dos 552 attendees** dos últimos 14 dias, a função faz uma query individual:

```typescript
// Para CADA attendee:
const { data: deal } = await supabase
  .from('crm_deals')
  .select('contact:crm_contacts(email, phone)')
  .eq('id', attendee.deal_id)
  .maybeSingle();
```

Isso resulta em ~552 queries sequenciais, causando timeout antes de completar.

---

## Solução: Otimizar com JOIN na Query Inicial

### Estratégia

Em vez de buscar cada contato individualmente, vamos modificar a query inicial para trazer email e phone via JOIN diretamente na consulta de attendees.

### Alteração no Arquivo

**`supabase/functions/webhook-make-contrato/index.ts`**

#### 1. Modificar a Query Inicial (linhas 55-75)

Antes:
```typescript
const { data: attendeesRaw, error: queryError } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    id, status, meeting_slot_id, attendee_name, attendee_phone, deal_id,
    meeting_slots!inner(id, scheduled_at, status, meeting_type, closer_id)
  `)
  ...
```

Depois:
```typescript
const { data: attendeesRaw, error: queryError } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    id, status, meeting_slot_id, attendee_name, attendee_phone, deal_id,
    meeting_slots!inner(id, scheduled_at, status, meeting_type, closer_id),
    crm_deals!deal_id(
      id,
      crm_contacts!contact_id(email, phone)
    )
  `)
  ...
```

#### 2. Remover Queries Individuais no Loop (linhas 107-117)

Remover o bloco:
```typescript
// Buscar email/phone do contato via deal_id
const { data: deal } = await supabase
  .from('crm_deals')
  .select('contact:crm_contacts(email, phone)')
  .eq('id', attendee.deal_id)
  .maybeSingle();

const contactEmail = deal?.contact?.email?.toLowerCase()?.trim() || '';
const contactPhone = deal?.contact?.phone?.replace(/\D/g, '') || '';
```

Substituir por acesso direto aos dados já carregados:
```typescript
// Dados já vieram no JOIN
const contactEmail = attendee.crm_deals?.crm_contacts?.email?.toLowerCase()?.trim() || '';
const contactPhone = (attendee.crm_deals?.crm_contacts?.phone || '').replace(/\D/g, '');
```

---

## Benefícios da Otimização

| Antes | Depois |
|-------|--------|
| 1 query inicial + 552 queries individuais | 1 única query com JOINs |
| ~20+ segundos (timeout) | ~1-2 segundos |
| Falha consistente | Execução rápida |

---

## Resumo das Mudanças

| Linha | Mudança |
|-------|---------|
| 55-75 | Adicionar JOIN com `crm_deals` e `crm_contacts` na query inicial |
| 107-117 | Remover query individual e usar dados do JOIN |
| 114-115 | Ajustar acesso ao email/phone para usar o novo caminho de dados |

---

## Impacto

- **Performance**: De timeout (~20s+) para ~1-2 segundos
- **Confiabilidade**: Webhooks do Make voltarão a funcionar
- **Automação**: Contratos serão marcados automaticamente como pagos
- **Notificações**: Closers receberão alertas para agendar R2

