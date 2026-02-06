
# Incluir Vendas Intermediadas no Filtro de Closer R1

## Problema Identificado

A RPC `get_all_hubla_transactions` não retorna o campo `linked_attendee_id`, então vendas que foram **manualmente vinculadas** a um attendee (intermediações) não são consideradas no filtro de closer.

## Solução

Adicionar o campo `linked_attendee_id` na consulta e usar no matching de closer.

## Alterações Técnicas

### 1. Atualizar a RPC `get_all_hubla_transactions`

Adicionar `ht.linked_attendee_id` no SELECT:

```sql
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 5000,
  p_products text[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  hubla_id text,
  product_name text,
  product_category text,
  product_price numeric,
  net_value numeric,
  customer_name text,
  customer_email text,
  customer_phone text,
  sale_date timestamp with time zone,
  sale_status text,
  installment_number integer,
  total_installments integer,
  source text,
  gross_override numeric,
  linked_attendee_id uuid  -- NOVO CAMPO
)
```

### 2. Atualizar Interface `HublaTransaction`

**Arquivo:** `src/hooks/useAllHublaTransactions.ts`

```typescript
export interface HublaTransaction {
  // ... campos existentes
  linked_attendee_id: string | null;  // NOVO
}
```

### 3. Expandir Lógica de Matching no Filtro

**Arquivo:** `src/pages/bu-incorporador/TransacoesIncorp.tsx`

Adicionar matching por `linked_attendee_id`:

```typescript
const filteredByCloser = useMemo(() => {
  if (selectedCloserId === 'all') return transactions;
  
  const closerAttendees = attendees.filter((a: any) => 
    a.meeting_slots?.closer_id === selectedCloserId
  );
  
  // IDs dos attendees do closer (para matching direto por linked_attendee_id)
  const closerAttendeeIds = new Set(
    closerAttendees.map((a: any) => a.id)
  );
  
  const closerEmails = new Set(
    closerAttendees
      .map((a: any) => a.crm_deals?.crm_contacts?.email?.toLowerCase())
      .filter(Boolean)
  );
  
  const closerPhones = new Set(
    closerAttendees
      .map((a: any) => (a.crm_deals?.crm_contacts?.phone || '').replace(/\D/g, ''))
      .filter((p: string) => p.length >= 8)
  );
  
  return transactions.filter(t => {
    const txEmail = (t.customer_email || '').toLowerCase();
    const txPhone = (t.customer_phone || '').replace(/\D/g, '');
    
    // Match por email ou telefone
    const emailMatch = closerEmails.has(txEmail);
    const phoneMatch = txPhone.length >= 8 && closerPhones.has(txPhone);
    
    // NOVO: Match por linked_attendee_id (vendas intermediadas)
    const linkedMatch = t.linked_attendee_id && closerAttendeeIds.has(t.linked_attendee_id);
    
    return emailMatch || phoneMatch || linkedMatch;
  });
}, [transactions, selectedCloserId, attendees]);
```

## Fluxo de Matching Completo

```text
┌─────────────────────────────────────────────────────────────────┐
│                     FILTRO POR CLOSER R1                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Transação → Atribuída ao Closer se:                            │
│                                                                  │
│  1. Email do cliente = Email do contato de um deal              │
│     que teve R1 com o closer                                    │
│                                                                  │
│  2. Telefone do cliente = Telefone do contato de um deal        │
│     que teve R1 com o closer                                    │
│                                                                  │
│  3. linked_attendee_id aponta para um attendee de R1            │
│     do closer (vendas vinculadas manualmente)                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **RPC** `get_all_hubla_transactions` | Adicionar `linked_attendee_id` no SELECT e RETURNS |
| `src/hooks/useAllHublaTransactions.ts` | Adicionar `linked_attendee_id` na interface |
| `src/pages/bu-incorporador/TransacoesIncorp.tsx` | Adicionar matching por `linked_attendee_id` |

## Resultado Esperado

Ao filtrar por "Julio":
- Vendas de clientes que fizeram R1 com Julio (match por email/telefone)
- **NOVO:** Vendas que foram manualmente vinculadas a attendees de R1 do Julio (intermediações)

Isso garante que TODAS as vendas atribuídas ao closer (seja automaticamente ou por intermediação manual) apareçam no filtro.
