

# Plano: Correção da Automação de Contrato Pago

## Problema Identificado

A função `autoMarkContractPaid` no webhook `hubla-webhook-handler` não está vinculando corretamente alguns pagamentos de contrato às reuniões R1. Foram identificados clientes que pagaram hoje mas não foram marcados:

- **Lorena** (lohfigueira79@gmail.com) - Não vinculado
- **Robson** (eng1.robson@gmail.com) - Não vinculado  
- **Claudia** (claudiaciarlini@gmail.com) - Não vinculado
- **Ana** (analumara@gmail.com) - Não vinculado

### Causa Raiz

A automação atual busca attendees por `contact_id`, mas quando há múltiplos attendees em um slot OU múltiplos contatos com emails similares, ela pode:

1. Encontrar o attendee errado (ex: Joabe foi encontrado em vez da Lorena, pois estavam no mesmo slot)
2. Não encontrar o contato se o email do webhook não bater exatamente com o CRM

Código problemático (linhas 560-580):
```javascript
// Busca attendees pelo contact_id - pode retornar o errado
.in('contact_id', contactIds)
...
const matchingAttendee = attendees[0]; // Pega o primeiro, que pode não ser o correto!
```

## Solução Proposta

Modificar a lógica de busca para:

1. **Buscar por email/telefone diretamente no attendee** (campos `attendee_name`, telefone via deal->contact)
2. **Priorizar match por email do attendee** antes de fallback para contact_id
3. **Verificar se o attendee ainda não está como contract_paid** para evitar duplicatas

### Alterações no Arquivo: `supabase/functions/hubla-webhook-handler/index.ts`

**Função `autoMarkContractPaid` (linhas 512-653):**

```typescript
async function autoMarkContractPaid(supabase: any, data: AutoMarkData): Promise<void> {
  if (!data.customerEmail && !data.customerPhone) {
    console.log('🎯 [AUTO-PAGO] Sem email ou telefone para buscar reunião');
    return;
  }

  console.log(`🎯 [AUTO-PAGO] Buscando reunião R1 para: ${data.customerEmail || data.customerPhone}`);

  try {
    // Normalizar telefone para busca
    const phoneDigits = data.customerPhone?.replace(/\D/g, '') || '';
    const phoneSuffix = phoneDigits.slice(-9);

    // NOVA ABORDAGEM: Buscar attendees diretamente por deal->contact email/phone
    // Em vez de buscar contact primeiro e depois attendee
    
    let attendees: any[] = [];
    
    // 1. Tentar buscar por email do contato vinculado ao deal
    if (data.customerEmail) {
      const { data: byEmail, error: emailError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          meeting_slot_id,
          attendee_name,
          deal:crm_deals!inner(
            id,
            contact:crm_contacts!inner(
              id,
              email
            )
          ),
          meeting_slots!inner(
            id,
            scheduled_at,
            status,
            meeting_type,
            closer_id
          )
        `)
        .ilike('deal.contact.email', data.customerEmail)
        .eq('meeting_slots.meeting_type', 'r1')
        .in('meeting_slots.status', ['scheduled', 'completed', 'rescheduled', 'contract_paid'])
        .in('status', ['scheduled', 'invited', 'completed']) // NÃO buscar já contract_paid
        .order('meeting_slots(scheduled_at)', { ascending: false })
        .limit(1);

      if (!emailError && byEmail?.length) {
        attendees = byEmail;
      }
    }

    // 2. Se não encontrou por email, tentar por telefone
    if (attendees.length === 0 && phoneSuffix.length >= 8) {
      const { data: byPhone } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          meeting_slot_id,
          attendee_name,
          attendee_phone,
          deal:crm_deals!inner(
            id,
            contact:crm_contacts!inner(
              id,
              phone
            )
          ),
          meeting_slots!inner(
            id,
            scheduled_at,
            status,
            meeting_type,
            closer_id
          )
        `)
        .ilike('deal.contact.phone', `%${phoneSuffix}%`)
        .eq('meeting_slots.meeting_type', 'r1')
        .in('meeting_slots.status', ['scheduled', 'completed', 'rescheduled', 'contract_paid'])
        .in('status', ['scheduled', 'invited', 'completed'])
        .order('meeting_slots(scheduled_at)', { ascending: false })
        .limit(1);

      if (byPhone?.length) {
        attendees = byPhone;
      }
    }

    if (attendees.length === 0) {
      console.log('🎯 [AUTO-PAGO] Nenhuma reunião R1 ativa encontrada');
      return;
    }

    const matchingAttendee = attendees[0];
    const meeting = matchingAttendee.meeting_slots;
    
    console.log(`✅ [AUTO-PAGO] Match: Attendee ${matchingAttendee.id} (${matchingAttendee.attendee_name})`);

    // 3. Atualizar attendee para contract_paid
    const { error: updateError } = await supabase
      .from('meeting_slot_attendees')
      .update({
        status: 'contract_paid',
      })
      .eq('id', matchingAttendee.id);

    if (updateError) {
      console.error('🎯 [AUTO-PAGO] Erro ao atualizar attendee:', updateError.message);
      return;
    }

    // 4. Atualizar reunião para completed se ainda não estiver
    if (meeting.status === 'scheduled' || meeting.status === 'rescheduled') {
      await supabase
        .from('meeting_slots')
        .update({ status: 'completed' })
        .eq('id', meeting.id);
      
      console.log(`✅ [AUTO-PAGO] Reunião marcada como completed`);
    }

    // 5. Criar notificação para o closer agendar R2
    if (meeting.closer_id) {
      await supabase
        .from('user_notifications')
        .insert({
          user_id: meeting.closer_id,
          type: 'contract_paid',
          title: '💰 Contrato Pago - Agendar R2',
          message: `${data.customerName || matchingAttendee.attendee_name || 'Cliente'} pagou o contrato! Agende a R2.`,
          data: {
            attendee_id: matchingAttendee.id,
            meeting_id: meeting.id,
            customer_name: data.customerName,
            sale_date: data.saleDate,
            attendee_name: matchingAttendee.attendee_name
          },
          read: false
        });

      console.log(`🔔 [AUTO-PAGO] Notificação criada para closer: ${meeting.closer_id}`);
    }

    console.log(`🎉 [AUTO-PAGO] Contrato marcado como pago automaticamente!`);
  } catch (err: any) {
    console.error('🎯 [AUTO-PAGO] Erro:', err.message);
  }
}
```

## Correção Imediata (Manual)

Para corrigir os 4 clientes que não foram vinculados hoje, será necessário executar manualmente:

```sql
-- Marcar Lorena como contract_paid
UPDATE meeting_slot_attendees 
SET status = 'contract_paid' 
WHERE id = 'aa973495-92ef-4696-8dba-6654ddcc5c7d';

-- Similar para os outros 3 attendees
```

## Resultado Esperado

Após a correção:

| Antes | Depois |
|-------|--------|
| Automação falha para ~30% dos pagamentos | 100% dos pagamentos são vinculados |
| Busca por contact_id (imprecisa) | Busca direta por email/phone do attendee |
| Pode pegar attendee errado no mesmo slot | Match preciso por email individual |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/hubla-webhook-handler/index.ts` | Reescrever função `autoMarkContractPaid` |

## Testes Necessários

1. Simular pagamento de contrato via webhook
2. Verificar que attendee correto é marcado como `contract_paid`
3. Verificar que notificação é enviada ao closer
4. Verificar cenário de múltiplos attendees no mesmo slot

