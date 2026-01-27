

# Plano: Adicionar Transferência de Propriedade ao autoMarkContractPaid

## Problema Identificado

Quando um contrato é pago (webhook Hubla), a função `autoMarkContractPaid` marca corretamente o attendee como `contract_paid`, mas **não transfere a propriedade do deal para o closer**.

| Lead | SDR (owner_id) | Closer R1 | Status Esperado |
|------|----------------|-----------|-----------------|
| Juliano Locatelli | juliana.rodrigues@ | julio.caetano@ | owner deveria ser Julio |
| Claudia Ciarlini | caroline.souza@ | julio.caetano@ | owner deveria ser Julio |

O código de transferência de propriedade existe apenas no frontend (`syncDealStageFromAgenda` em `useAgendaData.ts`), mas o webhook backend não o executa.

---

## Solução Proposta

Adicionar na função `autoMarkContractPaid` a lógica completa de transferência de propriedade após marcar o attendee como `contract_paid`:

```typescript
// 6. TRANSFERIR OWNERSHIP E MOVER ESTÁGIO DO DEAL
if (matchingAttendee.deal_id) {
  // Buscar email do closer
  const { data: closerData } = await supabase
    .from('closers')
    .select('email')
    .eq('id', meeting.closer_id)
    .single();
  
  const closerEmail = closerData?.email;
  
  if (closerEmail) {
    // Buscar deal atual
    const { data: deal } = await supabase
      .from('crm_deals')
      .select('owner_id, original_sdr_email, r1_closer_email, origin_id')
      .eq('id', matchingAttendee.deal_id)
      .single();
    
    if (deal) {
      // Buscar lista de closers para verificar se owner atual é closer
      const { data: closersList } = await supabase
        .from('closers')
        .select('email')
        .eq('is_active', true);
      
      const closerEmails = closersList?.map(c => c.email.toLowerCase()) || [];
      const isOwnerCloser = closerEmails.includes(deal.owner_id?.toLowerCase() || '');
      
      // Buscar profile_id do closer para owner_profile_id
      const { data: closerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', closerEmail)
        .single();
      
      // Buscar stage "Contrato Pago" no pipeline
      const { data: contractPaidStage } = await supabase
        .from('crm_stages')
        .select('id')
        .eq('origin_id', deal.origin_id)
        .ilike('stage_name', 'Contrato Pago')
        .single();
      
      // Atualizar deal com transferência de ownership
      const updatePayload: Record<string, unknown> = {
        owner_id: closerEmail,
        r1_closer_email: closerEmail,
      };
      
      // Preservar SDR original se owner atual não é closer
      if (!deal.original_sdr_email && deal.owner_id && !isOwnerCloser) {
        updatePayload.original_sdr_email = deal.owner_id;
      }
      
      // Atualizar owner_profile_id se encontrou o profile
      if (closerProfile?.id) {
        updatePayload.owner_profile_id = closerProfile.id;
      }
      
      // Mover para estágio Contrato Pago se encontrou
      if (contractPaidStage?.id) {
        updatePayload.stage_id = contractPaidStage.id;
      }
      
      await supabase
        .from('crm_deals')
        .update(updatePayload)
        .eq('id', matchingAttendee.deal_id);
      
      console.log(`✅ [AUTO-PAGO] Deal ${matchingAttendee.deal_id} transferido para ${closerEmail}`);
    }
  }
}
```

---

## Detalhes Técnicos

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/hubla-webhook-handler/index.ts` | Adicionar lógica de transferência após linha ~682 |

### Campos a Atualizar no Deal

| Campo | Valor | Descrição |
|-------|-------|-----------|
| `owner_id` | email do closer | Novo proprietário do lead |
| `owner_profile_id` | UUID do profile | Para joins com tabela profiles |
| `original_sdr_email` | email do SDR | Preservado para métricas |
| `r1_closer_email` | email do closer | Registro da cadeia de ownership |
| `stage_id` | ID do estágio "Contrato Pago" | Move o deal no Kanban |

### Fluxo Corrigido

```text
Webhook recebe pagamento de contrato
           ↓
autoMarkContractPaid encontra attendee
           ↓
Marca attendee como contract_paid
           ↓
Marca meeting slot como completed
           ↓
[NOVO] Busca closer email do meeting
           ↓
[NOVO] Atualiza deal:
  - owner_id → closer email
  - owner_profile_id → closer profile UUID
  - original_sdr_email → SDR original (preservado)
  - r1_closer_email → closer email
  - stage_id → "Contrato Pago"
           ↓
Cria notificação para closer
```

---

## Correção Manual Imediata

Para os leads Juliano e Claudia que já foram processados, será necessário atualizar manualmente:

```sql
-- Corrigir Juliano Locatelli
UPDATE crm_deals 
SET 
  owner_id = 'julio.caetano@minhacasafinanciada.com',
  original_sdr_email = 'juliana.rodrigues@minhacasafinanciada.com',
  r1_closer_email = 'julio.caetano@minhacasafinanciada.com'
WHERE id = '79e1b425-6832-4eb6-b086-022de05e7e89';

-- Corrigir Claudia Ciarlini
UPDATE crm_deals 
SET 
  owner_id = 'julio.caetano@minhacasafinanciada.com',
  original_sdr_email = 'caroline.souza@minhacasafinanciada.com',
  r1_closer_email = 'julio.caetano@minhacasafinanciada.com'
WHERE id = '93c1ccfd-ab11-421e-819a-f37d9e235628';
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Attendee marcado contract_paid | Attendee marcado contract_paid |
| Deal continua com SDR | Deal transferido para Closer |
| original_sdr_email = null | original_sdr_email = SDR email |
| r1_closer_email = null | r1_closer_email = Closer email |
| stage = qualquer | stage = "Contrato Pago" |

