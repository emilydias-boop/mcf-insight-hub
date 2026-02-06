
# Adicionar Filtro de Closer na Pagina de Transacoes

## Contexto

A pagina "Vendas MCF INCORPORADOR" (`TransacoesIncorp.tsx`) nao possui filtro de Closer, enquanto o SalesReportPanel ja tem essa funcionalidade implementada. Vamos adicionar o mesmo filtro.

## Logica de Matching

Como as transacoes nao tem relacao direta com closers no banco, o matching e feito via:
1. Buscar attendees que pagaram contrato (`status = 'contract_paid'`)
2. Cruzar por email ou telefone do cliente da transacao com o contato do deal do attendee
3. O closer e identificado pelo `meeting_slots.closer_id` do attendee

## Alteracoes Necessarias

### Arquivo: `src/pages/bu-incorporador/TransacoesIncorp.tsx`

#### 1. Adicionar imports necessarios

```typescript
import { useGestorClosers } from '@/hooks/useGestorClosers';
```

#### 2. Adicionar estado para filtro de closer

```typescript
const [selectedCloserId, setSelectedCloserId] = useState<string>('all');
```

#### 3. Buscar lista de closers

```typescript
// Closers disponiveis para filtro
const { data: closers = [] } = useGestorClosers();
```

#### 4. Buscar attendees para matching

```typescript
// Attendees para matching de closer com transacoes
const { data: attendees = [] } = useQuery({
  queryKey: ['attendees-for-matching', startDate?.toISOString(), endDate?.toISOString()],
  queryFn: async () => {
    if (!startDate) return [];
    
    const { data, error } = await supabase
      .from('meeting_slot_attendees')
      .select(`
        id, attendee_phone, deal_id,
        meeting_slots!inner(closer_id),
        crm_deals!deal_id(crm_contacts!contact_id(email, phone))
      `)
      .eq('status', 'contract_paid')
      .gte('contract_paid_at', startDate.toISOString());
    
    if (error) throw error;
    return data || [];
  },
  enabled: !!startDate,
});
```

#### 5. Adicionar filtro por closer no processamento

```typescript
// Filtrar por closer (via matching com attendees)
const filteredByCloser = useMemo(() => {
  if (selectedCloserId === 'all') return transactions;
  
  const closerAttendees = attendees.filter((a: any) => 
    a.meeting_slots?.closer_id === selectedCloserId
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
    
    return closerEmails.has(txEmail) || 
           (txPhone.length >= 8 && closerPhones.has(txPhone));
  });
}, [transactions, selectedCloserId, attendees]);
```

#### 6. Adicionar Select de Closer na UI (nos filtros)

```jsx
<div className="w-full sm:w-48">
  <label className="text-sm font-medium mb-2 block">Closer</label>
  <Select value={selectedCloserId} onValueChange={(v) => {
    setSelectedCloserId(v);
    setCurrentPage(1);
  }}>
    <SelectTrigger>
      <SelectValue placeholder="Todos" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos</SelectItem>
      {closers.map(closer => (
        <SelectItem key={closer.id} value={closer.id}>
          {closer.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

#### 7. Atualizar totais e agrupamentos para usar dados filtrados

Substituir `transactions` por `filteredByCloser` nos calculos de:
- `transactionGroups`
- `totals`

#### 8. Atualizar funcao de limpar filtros

```typescript
const handleClearFilters = () => {
  setSearchTerm('');
  setStartDate(undefined);
  setEndDate(undefined);
  setSelectedProducts([]);
  setSelectedCloserId('all');  // Adicionar
  setCurrentPage(1);
};
```

## Resultado Final

A pagina tera um novo filtro "Closer" que permite:
- Ver todas as transacoes (padrao)
- Filtrar por closer especifico
- O matching e feito por email ou telefone do cliente
- Os totais (bruto/liquido) serao atualizados de acordo com o filtro

## Observacao

O filtro funciona cruzando dados de attendees que pagaram contrato. Transacoes de clientes que nao passaram pelo funil de reunioes (vendas diretas, bio, etc) nao aparecerao ao filtrar por closer especifico - apenas na opcao "Todos".
