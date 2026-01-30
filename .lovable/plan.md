
# Plano: Corrigir Duplicação de Aprovados no Carrinho R2

## Problema Identificado

A aba "Aprovados" mostra **54 registros**, mas 2 estão duplicados:

| Lead | Causa da Duplicação |
|------|---------------------|
| **Victor Hugo Lima Silva** | Reunião original (27/01) foi reagendada para 28/01. Ambos os registros têm status "Aprovado" |
| **Leonardo Schwab Dias Carneiro** | Mesmo lead foi agendado em 2 reuniões diferentes (27/01 com Claudia, 28/01 com Jessica). Ambas completed |

### Análise dos Dados

**Victor Hugo:**
- Attendee original (27/01): `meeting_status=rescheduled`, `parent_attendee_id=NULL`
- Attendee reagendado (28/01): `meeting_status=completed`, `parent_attendee_id=a7e96a82...` (aponta para o original)

**Leonardo Schwab:**
- Attendee 1 (27/01 - Claudia): `meeting_status=completed`, `parent_attendee_id=NULL`
- Attendee 2 (28/01 - Jessica): `meeting_status=completed`, `parent_attendee_id=NULL`

---

## Causa Raiz

O código atual em `useR2CarrinhoData.ts` não faz deduplicação por `deal_id`. Quando um lead é aprovado em múltiplas reuniões (seja por reagendamento ou agendamento duplicado), ele aparece múltiplas vezes na lista.

O hook de KPIs (`useR2CarrinhoKPIs.ts`) também não deduplica - conta todos os attendees com status aprovado.

---

## Solução Proposta

Implementar deduplicação por `deal_id` na aba "Aprovados", mantendo apenas o registro mais recente de cada lead.

### Lógica de Deduplicação

Para cada `deal_id` com múltiplos attendees aprovados:
1. Priorizar attendees de reuniões `completed` sobre `rescheduled`
2. Entre `completed`, manter o mais recente (`scheduled_at` maior)
3. Resultado: 1 registro por lead/deal

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useR2CarrinhoData.ts` | Adicionar deduplicação por `deal_id` no filtro "aprovados" |
| `src/hooks/useR2CarrinhoKPIs.ts` | Adicionar deduplicação por `deal_id` na contagem de aprovados |

---

## Detalhes Técnicos

### Modificação em useR2CarrinhoData.ts

Após coletar todos os attendees aprovados, adicionar lógica de deduplicação:

```typescript
// Após linha 190, antes do return

// Para aprovados, deduplicar por deal_id (manter reunião mais recente)
if (filter === 'aprovados') {
  const dealMap = new Map<string, R2CarrinhoAttendee>();
  
  for (const att of attendees) {
    const key = att.deal_id || att.id; // Usar attendee ID se não tiver deal
    const existing = dealMap.get(key);
    
    if (!existing) {
      dealMap.set(key, att);
    } else {
      // Priorizar: completed > rescheduled > outros
      const attPriority = att.meeting_status === 'completed' ? 2 : 
                          att.meeting_status === 'rescheduled' ? 1 : 0;
      const existingPriority = existing.meeting_status === 'completed' ? 2 :
                               existing.meeting_status === 'rescheduled' ? 1 : 0;
      
      if (attPriority > existingPriority) {
        dealMap.set(key, att);
      } else if (attPriority === existingPriority) {
        // Mesmo status: manter o mais recente
        if (new Date(att.scheduled_at) > new Date(existing.scheduled_at)) {
          dealMap.set(key, att);
        }
      }
    }
  }
  
  return Array.from(dealMap.values());
}

return attendees;
```

### Modificação em useR2CarrinhoKPIs.ts

Adicionar deduplicação similar na contagem de aprovados:

```typescript
// Linha 103-107: Mudar de contagem simples para deduplicação
const allAttendees = (r2Meetings || []).flatMap(m => 
  (m.attendees || []).map(a => ({
    ...a,
    scheduled_at: m.scheduled_at,
    meeting_status: m.status
  }))
);

// Deduplicar aprovados por deal_id
const aprovadoAttendees = allAttendees.filter(a => a.r2_status_id === aprovadoStatusId);
const aprovadosDeduplicated = new Map<string, typeof aprovadoAttendees[0]>();

for (const att of aprovadoAttendees) {
  // Buscar deal_id do attendee
  const key = att.deal_id || att.id;
  const existing = aprovadosDeduplicated.get(key);
  
  if (!existing || 
      (att.meeting_status === 'completed' && existing.meeting_status !== 'completed') ||
      (att.meeting_status === existing.meeting_status && 
       new Date(att.scheduled_at) > new Date(existing.scheduled_at))) {
    aprovadosDeduplicated.set(key, att);
  }
}

const aprovados = aprovadosDeduplicated.size;
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| KPI Aprovados | 54 | 52 |
| Lista Aprovados | 54 (2 duplicados) | 52 (sem duplicados) |
| Victor Hugo Lima Silva | 2 registros | 1 registro (28/01 - completed) |
| Leonardo Schwab Dias Carneiro | 2 registros | 1 registro (28/01 - mais recente) |

---

## Observação

Para o caso de Leonardo Schwab, aparentemente houve um agendamento duplicado (2 reuniões diferentes com closers diferentes). A solução proposta mantém apenas o registro mais recente (28/01 - Jessica Bellini), mas pode ser necessário investigar como isso ocorreu para evitar duplicações futuras no processo de agendamento.
