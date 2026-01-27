
# Plano: Corrigir Bug de Matching na Funcao autoMarkContractPaid

## Problema Identificado

Dois contratos pagos ontem (26/01) nao foram marcados automaticamente como `contract_paid`:

| Cliente | Telefone | Pagamento | Problema |
|---------|----------|-----------|----------|
| Claudia Ciarlini Martins | 5999279991 | 27/01 00:33 | Email diferente: pagou com `gmail`, CRM tem `hotmail` |
| Juliano Locatelli | 49999362228 | 26/01 23:04 | Email correto, mas NAO foi encontrado |

### Analise Tecnica

**Dados do Juliano (deveria ter funcionado):**
- Email no pagamento: `juliano.locatelli@yahoo.com.br`
- Email no CRM: `juliano.locatelli@yahoo.com.br` (IGUAL)
- Reuniao R1: 26/01 22:15 com Julio (status: invited, meeting: completed)
- Transacao registrada: Sim, categoria `incorporador`, valor R$ 497

**Dados da Claudia:**
- Email no pagamento: `claudiaciarlini@gmail.com`
- Email no CRM: `claudiaciarlini@hotmail.com` (DIFERENTE)
- Telefone: `+5585999279991` (IGUAL nos dois)
- Reuniao R1: 26/01 23:30 com Julio (status: invited)

### Causas Raiz

1. **Query retorna 470 attendees** - A funcao busca TODOS os attendees R1 pendentes da base, iterando um a um para fazer o matching
2. **Ordenacao nested pode nao funcionar** - A sintaxe `.order('meeting_slots(scheduled_at)')` pode nao ordenar corretamente no Supabase
3. **Match por email antes de telefone** - Se o email nao bate (Claudia), o codigo continua para telefone, mas pode nao encontrar
4. **Sem limite temporal** - Busca attendees de semanas/meses atras, aumentando chance de match incorreto

---

## Solucao Proposta

### Modificacao 1: Limitar Busca a Reunioes Recentes (14 dias)

Adicionar filtro de data para buscar apenas reunioes dos ultimos 14 dias, reduzindo de 470 para ~50-100 attendees:

```typescript
const twoWeeksAgo = new Date();
twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

const { data: attendees } = await supabase
  .from('meeting_slot_attendees')
  .select(`...`)
  .eq('meeting_slots.meeting_type', 'r1')
  .gte('meeting_slots.scheduled_at', twoWeeksAgo.toISOString()) // NOVO
  .in('meeting_slots.status', ['scheduled', 'completed', 'rescheduled', 'contract_paid'])
  .in('status', ['scheduled', 'invited', 'completed']);
```

### Modificacao 2: Ordenar no JavaScript (mais confiavel)

Remover a ordenacao do Supabase e ordenar em JavaScript para garantir que reunioes mais recentes sejam processadas primeiro:

```typescript
// Ordenar por data mais recente primeiro
attendees.sort((a, b) => {
  const dateA = new Date(a.meeting_slots?.scheduled_at || 0);
  const dateB = new Date(b.meeting_slots?.scheduled_at || 0);
  return dateB.getTime() - dateA.getTime();
});
```

### Modificacao 3: Melhorar Match por Telefone

Se o email nao bater, fazer match por telefone imediatamente (em vez de esperar o proximo attendee):

```typescript
for (const attendee of attendees) {
  const { data: deal } = await supabase
    .from('crm_deals')
    .select('contact:crm_contacts(email, phone)')
    .eq('id', attendee.deal_id)
    .maybeSingle();

  const contactEmail = deal?.contact?.email?.toLowerCase() || '';
  const contactPhone = deal?.contact?.phone?.replace(/\D/g, '') || '';

  // Match por EMAIL (prioridade 1)
  if (emailLower && contactEmail === emailLower) {
    matchingAttendee = attendee;
    matchType = 'email';
    break;
  }

  // Match por TELEFONE (prioridade 2) - verificar MESMO se email nao bateu
  if (phoneSuffix.length >= 8) {
    const attendeePhoneClean = attendee.attendee_phone?.replace(/\D/g, '') || '';
    if (contactPhone.endsWith(phoneSuffix) || attendeePhoneClean.endsWith(phoneSuffix)) {
      // Guardar como candidato, mas continuar buscando match por email
      if (!phoneMatchCandidate) {
        phoneMatchCandidate = { attendee, meeting: attendee.meeting_slots };
      }
    }
  }
}

// Se nao encontrou por email, usar match por telefone
if (!matchingAttendee && phoneMatchCandidate) {
  matchingAttendee = phoneMatchCandidate.attendee;
  meeting = phoneMatchCandidate.meeting;
  matchType = 'telefone';
}
```

### Modificacao 4: Adicionar Logs Detalhados de Matching

```typescript
console.log(`🎯 [AUTO-PAGO] Buscando match para: email=${emailLower}, phone_suffix=${phoneSuffix}`);
console.log(`🎯 [AUTO-PAGO] ${attendees.length} attendees encontrados (ultimos 14 dias)`);

// No loop
console.log(`🔍 Verificando: ${attendee.attendee_name} (email: ${contactEmail}, phone: ${contactPhone})`);

// Match final
console.log(`✅ Match por ${matchType}: ${matchingAttendee.attendee_name} - deal: ${matchingAttendee.deal_id}`);
```

---

## Arquivos a Modificar

| Arquivo | Tipo de Mudanca |
|---------|-----------------|
| `supabase/functions/hubla-webhook-handler/index.ts` | Refatorar funcao `autoMarkContractPaid` (linhas 512-700) |

---

## Detalhes Tecnicos

### Funcao Completa Refatorada

A funcao `autoMarkContractPaid` sera atualizada para:

1. **Filtrar por data** - Apenas reunioes dos ultimos 14 dias
2. **Ordenar em JS** - Garantir que reunioes mais recentes venham primeiro
3. **Match em duas fases** - Primeiro por email, depois por telefone como fallback
4. **Logs detalhados** - Facilitar debugging de casos futuros

### Fluxo Corrigido

```text
Webhook recebe pagamento de contrato (R$ 497)
           |
           v
Buscar attendees R1 dos ULTIMOS 14 DIAS
           |
           v
Ordenar por data (mais recente primeiro)
           |
           v
Para cada attendee:
  - Buscar email/phone do contato via deal_id
  - Se email = email do pagamento -> MATCH IMEDIATO
  - Se telefone termina igual -> GUARDAR como candidato
           |
           v
Se nao achou por email, usar candidato de telefone
           |
           v
Marcar attendee como contract_paid
```

---

## Resultado Esperado

| Cenario | Antes | Depois |
|---------|-------|--------|
| Email igual | Funciona (as vezes) | Funciona (sempre) |
| Email diferente, telefone igual | NAO funciona | Funciona via telefone |
| Muitos attendees (470) | Lento/timeout | Rapido (~50-100) |
| Logs | Insuficientes | Detalhados |

### Casos que serao resolvidos:
- Claudia Ciarlini: Match por telefone (emails diferentes)
- Juliano Locatelli: Match por email (com ordenacao correta)
