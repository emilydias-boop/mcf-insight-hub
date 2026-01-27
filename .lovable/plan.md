
# Plano: Corrigir Bug no autoMarkContractPaid para Multiplos Leads no Mesmo Slot

## Problema Identificado

Quando multiplos leads estao no mesmo slot R1 e pagam o contrato em sequencia, apenas o primeiro e marcado automaticamente como `contract_paid`. Os demais nao sao processados corretamente.

### Caso Real Analisado

| Lead | Horario Pagamento | Status Atual | Atualizado Por |
|------|-------------------|--------------|----------------|
| Mauricio Albuquerque | 19:31 | contract_paid | Webhook (automatico) |
| William Santos gondim | 19:36 | contract_paid | Manual (20:04) |

Ambos estavam no mesmo slot (`70df5974...`) com status `invited` no momento do pagamento.

### Causa Raiz

O codigo atual na funcao `autoMarkContractPaid` tem dois problemas:

**Problema 1 - Query Retorna Dados Inconsistentes**

A query usa `!inner` join com `crm_contacts` para filtrar por email:

```typescript
const { data: attendees } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    id, status, ...
    deal:crm_deals!inner(
      contact:crm_contacts!inner(email)
    ),
    meeting_slots!inner(...)
  `)
  .in('status', ['scheduled', 'invited', 'completed'])
```

Quando existem **multiplos contatos duplicados** com o mesmo email (4 contatos para William), o Supabase pode retornar resultados inconsistentes ou nao encontrar o attendee correto.

**Problema 2 - find() Retorna Apenas o Primeiro Match**

```typescript
const matched = attendees.find((a: any) => 
  a.deal?.contact?.email?.toLowerCase() === emailLower
);
```

Mesmo que a query retorne o attendee correto, se houver multiplos resultados, apenas o primeiro e processado.

## Solucao Proposta

### Modificacao 1: Simplificar a Query e Melhorar o Matching

Em vez de fazer JOIN complexo com multiplas tabelas que pode retornar resultados duplicados, buscar attendees diretamente e fazer o matching de forma mais robusta:

```typescript
async function autoMarkContractPaid(supabase: any, data: AutoMarkData): Promise<void> {
  if (!data.customerEmail && !data.customerPhone) {
    console.log('🎯 [AUTO-PAGO] Sem email ou telefone para buscar reunião');
    return;
  }

  console.log(`🎯 [AUTO-PAGO] Buscando reunião R1 para: ${data.customerEmail || data.customerPhone}`);

  try {
    const phoneDigits = data.customerPhone?.replace(/\D/g, '') || '';
    const phoneSuffix = phoneDigits.slice(-9);
    const emailLower = data.customerEmail?.toLowerCase() || '';

    // NOVA ABORDAGEM: Buscar TODOS os attendees R1 pendentes (sem contract_paid)
    // e fazer matching local mais robusto
    const { data: attendees, error: queryError } = await supabase
      .from('meeting_slot_attendees')
      .select(`
        id,
        status,
        meeting_slot_id,
        attendee_name,
        attendee_phone,
        deal_id,
        meeting_slots!inner(
          id,
          scheduled_at,
          status,
          meeting_type,
          closer_id
        )
      `)
      .eq('meeting_slots.meeting_type', 'r1')
      .in('meeting_slots.status', ['scheduled', 'completed', 'rescheduled', 'contract_paid'])
      .in('status', ['scheduled', 'invited', 'completed'])
      .order('meeting_slots(scheduled_at)', { ascending: false });

    if (queryError) {
      console.error('🎯 [AUTO-PAGO] Erro na query:', queryError.message);
      return;
    }

    if (!attendees?.length) {
      console.log('🎯 [AUTO-PAGO] Nenhum attendee R1 pendente encontrado');
      return;
    }

    console.log(`🎯 [AUTO-PAGO] ${attendees.length} attendees encontrados, buscando match...`);

    // Para cada attendee, buscar o email do contato vinculado
    let matchingAttendee: any = null;
    let meeting: any = null;

    for (const attendee of attendees) {
      if (!attendee.deal_id) continue;

      // Buscar o contato vinculado ao deal
      const { data: deal } = await supabase
        .from('crm_deals')
        .select('contact:crm_contacts(email, phone)')
        .eq('id', attendee.deal_id)
        .maybeSingle();

      const contactEmail = deal?.contact?.email?.toLowerCase() || '';
      const contactPhone = deal?.contact?.phone?.replace(/\D/g, '') || '';

      // Match por email (prioridade)
      if (emailLower && contactEmail === emailLower) {
        matchingAttendee = attendee;
        meeting = attendee.meeting_slots;
        console.log(`✅ [AUTO-PAGO] Match por EMAIL: ${attendee.attendee_name} (${attendee.id})`);
        break;
      }

      // Match por telefone (fallback)
      if (!matchingAttendee && phoneSuffix.length >= 8) {
        if (contactPhone.endsWith(phoneSuffix) || 
            attendee.attendee_phone?.replace(/\D/g, '').endsWith(phoneSuffix)) {
          matchingAttendee = attendee;
          meeting = attendee.meeting_slots;
          console.log(`✅ [AUTO-PAGO] Match por TELEFONE: ${attendee.attendee_name} (${attendee.id})`);
          break;
        }
      }
    }

    if (!matchingAttendee) {
      console.log('🎯 [AUTO-PAGO] Nenhum match encontrado para este cliente');
      return;
    }

    // ... resto do codigo (atualizar status, criar notificacao) permanece igual
  } catch (err: any) {
    console.error('🎯 [AUTO-PAGO] Erro:', err.message);
  }
}
```

### Modificacao 2: Adicionar Logs Detalhados

Para facilitar debugging de casos futuros, adicionar logs mais detalhados:

```typescript
console.log(`🎯 [AUTO-PAGO] Dados recebidos:`, {
  email: data.customerEmail,
  phone: data.customerPhone,
  name: data.customerName,
  saleDate: data.saleDate
});

// Apos buscar attendees
console.log(`🎯 [AUTO-PAGO] Attendees encontrados:`, attendees?.map((a: any) => ({
  id: a.id,
  name: a.attendee_name,
  status: a.status,
  deal_id: a.deal_id
})));
```

## Arquivos a Modificar

| Arquivo | Tipo de Mudanca |
|---------|-----------------|
| `supabase/functions/hubla-webhook-handler/index.ts` | Refatorar funcao `autoMarkContractPaid` |

## Detalhes Tecnicos

### Linha de Modificacao

Substituir a funcao `autoMarkContractPaid` (linhas 512-696) pela nova versao que:

1. **Busca attendees sem JOIN complexo com crm_contacts** - Evita problemas com contatos duplicados
2. **Faz lookup individual do contato** - Para cada attendee, busca o contato correto via deal_id
3. **Matching sequencial com break** - Para no primeiro match valido
4. **Logs detalhados** - Facilita debugging futuro

### Fluxo Corrigido

```text
Webhook chega com email/telefone do cliente
           ↓
Buscar TODOS os attendees R1 pendentes (sem JOIN com contacts)
           ↓
Para cada attendee:
  - Buscar contato via deal_id
  - Comparar email/telefone
  - Se match → marcar como contract_paid e PARAR
           ↓
Se nenhum match → log e retornar
```

### Beneficios da Solucao

1. **Evita problemas com contatos duplicados** - Busca o contato correto via deal_id
2. **Funcionamento consistente** - Cada pagamento marca o attendee correto
3. **Melhor logging** - Facilita identificar problemas futuros
4. **Compatibilidade** - Nao quebra logica existente de notificacoes e atualizacao de status

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Apenas 1o lead marcado automaticamente | Todos os leads marcados corretamente |
| Contatos duplicados causam conflito | Matching via deal_id evita conflito |
| Logs insuficientes para debug | Logs detalhados por attendee |
