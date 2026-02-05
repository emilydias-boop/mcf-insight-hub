
# Plano: Corrigir Duplicação de Atribuição de Contratos Pagos

## Problema Identificado

O lead **Eduardo Spadaro** foi atribuído incorretamente ao **Julio** quando deveria estar apenas com o **Mateus Macedo**. Isso acontece porque:

1. O mesmo `deal_id` tem **múltiplos attendees** em reuniões diferentes
2. O sistema **não verifica** se já existe outro attendee do mesmo deal marcado como `contract_paid`
3. Resultado: **dois closers recebem crédito** pelo mesmo contrato

### Dados do Caso

| Closer | Data Reunião | Status | contract_paid_at |
|--------|--------------|--------|------------------|
| Mateus Macedo | 04/02 22:00 | contract_paid | 05/02 01:19 |
| Julio | 29/01 21:00 | contract_paid | 04/02 23:41 |
| Julio | 31/01 17:00 | no_show | - |

Como o contrato do Julio foi registrado em **04/02**, ele aparece nas métricas de "hoje" (04/02), enquanto o contrato correto do Mateus só aparecerá nas métricas de **05/02**.

---

## Solução

### 1. Correção Imediata dos Dados

Executar SQL para remover o `contract_paid` incorreto do attendee do Julio:

```text
UPDATE meeting_slot_attendees 
SET 
  status = 'scheduled',
  contract_paid_at = NULL
WHERE id = '378717c3-c04b-4c2b-a1fd-a35dff44681c';
-- Attendee do Julio (29/01) que foi incorretamente marcado
```

### 2. Prevenção de Duplicatas no Webhook

Modificar `hubla-webhook-handler` para verificar se o `deal_id` já possui outro attendee com `contract_paid`:

**Arquivo:** `supabase/functions/hubla-webhook-handler/index.ts`

**Adicionar verificação após encontrar o match (linha ~761):**

```typescript
// NOVA VERIFICAÇÃO: Evitar duplicatas por deal_id
if (matchingAttendee.deal_id) {
  const { data: existingPaid } = await supabase
    .from('meeting_slot_attendees')
    .select('id, meeting_slots!inner(closer_id, scheduled_at)')
    .eq('deal_id', matchingAttendee.deal_id)
    .not('contract_paid_at', 'is', null)
    .neq('id', matchingAttendee.id)
    .limit(1)
    .maybeSingle();
  
  if (existingPaid) {
    console.log(`⚠️ [AUTO-PAGO] Deal ${matchingAttendee.deal_id} JÁ possui outro attendee pago (${existingPaid.id}). Pulando para evitar duplicata.`);
    return;
  }
}
```

### 3. Prevenção de Duplicatas na Vinculação Manual

Modificar `useLinkContractToAttendee.ts` para verificar duplicatas antes de vincular:

**Arquivo:** `src/hooks/useLinkContractToAttendee.ts`

**Adicionar verificação no início da mutação:**

```typescript
mutationFn: async ({ transactionId, attendeeId, dealId }: LinkContractParams) => {
  // NOVA VERIFICAÇÃO: Evitar duplicatas por deal_id
  if (dealId) {
    const { data: existingPaid } = await supabase
      .from('meeting_slot_attendees')
      .select('id, attendee_name')
      .eq('deal_id', dealId)
      .not('contract_paid_at', 'is', null)
      .neq('id', attendeeId)
      .limit(1)
      .maybeSingle();
    
    if (existingPaid) {
      throw new Error(`Este lead já possui contrato pago vinculado a outro attendee (${existingPaid.attendee_name})`);
    }
  }
  
  // ... resto do código existente
```

---

## Fluxo Corrigido

```text
Webhook Hubla recebe pagamento
    |
    V
Busca attendee por email/telefone
    |
    V
NOVO: Verifica se deal_id já tem outro attendee pago
    |
    +-- Se SIM: Log e ignora (evita duplicata)
    |
    +-- Se NÃO: Marca attendee como contract_paid
```

---

## Resultado Esperado

1. **Imediato**: Corrigir o contrato do Eduardo Spadaro - Julio perde 1 contrato, Mateus mantém 1
2. **Futuro**: Impossível criar duplicatas - sistema verifica antes de atribuir
3. **Métricas**: Cada contrato é contado apenas uma vez, para o closer correto

---

## Notas para Correção Manual

Se preferir corrigir manualmente via SQL no Supabase Dashboard:

1. Acessar SQL Editor
2. Executar a query de correção do item 1
3. Recarregar a página do Painel Comercial

Isso removerá o crédito incorreto do Julio e manterá apenas o crédito correto do Mateus Macedo.
