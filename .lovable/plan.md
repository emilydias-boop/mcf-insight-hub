
# Plano: Corrigir Matching Automático de Contrato Pago

## Problema Diagnosticado

### Dados do Caso Henrique Bergamini:
- **Transação**: henrickbergamini85@gmail.com, +5531995481915, R$ 497 (14:25 UTC)
- **Attendee**: henrickbergamini85@gmail.com, 31995481915 (reunião 13:15 UTC)
- **Status atual**: `completed` mas `contract_paid_at = NULL`
- **Resultado**: 3 transações duplicadas, nenhuma vinculada

### Causas Identificadas:

**1. Padrão N+1 no hubla-webhook-handler (Principal)**
O `autoMarkContractPaid` faz uma query individual para cada attendee buscar o email/phone do contato:
```javascript
// Para cada attendee (287+ registros)...
const { data: deal } = await supabase
  .from('crm_deals')
  .select('contact:crm_contacts(email, phone)')
  .eq('id', attendee.deal_id)
  .maybeSingle();
```

Isso causa timeouts e race conditions com muitos attendees.

**2. Inconsistência entre Webhooks**
O `webhook-make-contrato` usa JOIN (performático):
```javascript
crm_deals!deal_id(
  id,
  crm_contacts!contact_id(email, phone)
)
```

Enquanto `hubla-webhook-handler` faz N+1 queries (lento).

**3. Falta de Fallback por Nome**
Quando email e telefone falham (formatação diferente, dados incompletos), não há fallback por nome similar.

---

## Solução

Atualizar o `hubla-webhook-handler` para usar o mesmo padrão performático do `webhook-make-contrato`.

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/hubla-webhook-handler/index.ts` | Refatorar autoMarkContractPaid para usar JOIN |

### Mudanças Específicas

**1. Alterar a query para incluir dados do contato via JOIN:**

```javascript
// ANTES (N+1 - lento)
const { data: attendeesRaw } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    id, status, meeting_slot_id, attendee_name, attendee_phone, deal_id,
    meeting_slots!inner(...)
  `)
  ...

// Para cada attendee:
const { data: deal } = await supabase
  .from('crm_deals')
  .select('contact:crm_contacts(email, phone)')
  .eq('id', attendee.deal_id)
  .maybeSingle();

// DEPOIS (JOIN - rápido)
const { data: attendeesRaw } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    id, status, meeting_slot_id, attendee_name, attendee_phone, deal_id,
    meeting_slots!inner(...),
    crm_deals!deal_id(
      id,
      crm_contacts!contact_id(email, phone)
    )
  `)
  ...

// Acesso direto sem query adicional:
const contactEmail = attendee.crm_deals?.crm_contacts?.email;
```

**2. Adicionar fallback por nome normalizado:**

```javascript
// Match por NOME (prioridade 3) - fuzzy match como último recurso
if (!matchingAttendee && !phoneMatchCandidate && data.customerName) {
  const normalizedSearchName = normalizeNameForMatch(data.customerName);
  
  for (const attendee of attendees) {
    const normalizedAttendeeName = normalizeNameForMatch(attendee.attendee_name);
    if (normalizedAttendeeName === normalizedSearchName) {
      nameMatchCandidate = { attendee, meeting: attendee.meeting_slots };
      console.log(`📝 [AUTO-PAGO] Candidato por NOME: ${attendee.attendee_name}`);
      break;
    }
  }
}

function normalizeNameForMatch(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '') // Só alfanuméricos
    .trim();
}
```

**3. Melhorar logs para diagnóstico:**

```javascript
// Log detalhado quando não encontra match
if (!matchingAttendee) {
  console.log(`❌ [AUTO-PAGO] Nenhum match encontrado:`);
  console.log(`   - Email buscado: "${emailLower}"`);
  console.log(`   - Phone suffix: "${phoneSuffix}"`);
  console.log(`   - Nome: "${data.customerName}"`);
  console.log(`   - Total attendees verificados: ${attendees.length}`);
  console.log(`   - Attendees com deal_id: ${attendees.filter(a => a.deal_id).length}`);
  return;
}
```

---

## Fluxo Corrigido

```text
ANTES (N+1 - lento/falível):
┌─────────────────────────────────────────────────────────────────┐
│ 1. Query attendees (287 registros)                              │
│ 2. Para CADA attendee:                                          │
│    → Query crm_deals → Query crm_contacts                       │
│    → Total: 287+ queries adicionais                             │
│ 3. Timeout ou race condition → Match falha                      │
└─────────────────────────────────────────────────────────────────┘

DEPOIS (JOIN - rápido):
┌─────────────────────────────────────────────────────────────────┐
│ 1. Query attendees com JOIN (1 query com todos os dados)        │
│ 2. Loop em memória para matching (sem queries adicionais)       │
│ 3. Match por email → phone → nome (3 prioridades)               │
│ 4. Atualização atômica                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testes Necessários

1. **Reprocessar Henrique manualmente** após deploy para validar fix
2. **Monitorar logs** nas próximas vendas de contrato
3. **Verificar métricas de tempo** de execução do webhook

---

## Resumo Técnico

- **Arquivo modificado**: `supabase/functions/hubla-webhook-handler/index.ts`
- **Linhas afetadas**: ~600-720 (função autoMarkContractPaid)
- **Impacto**: Reduz tempo de execução de 10-30s para ~500ms
- **Compatibilidade**: Mantém mesma lógica do webhook-make-contrato que já funciona
