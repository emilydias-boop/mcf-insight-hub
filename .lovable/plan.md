
# Plano: Unificar Filtros do Relatório de Vendas com o de Contratos

## Objetivo

Adicionar na aba **Vendas** os mesmos filtros disponíveis na aba de **Contratos**:
- **Período** (já existe)
- **Buscar** (já existe)
- **Fonte** (NOVO) - Hubla, Make, Todos
- **Closer** (NOVO) - lista de closers R1
- **Pipeline** (NOVO) - origens do CRM
- **Canal** (já existe)

As KPIs devem acompanhar os dados filtrados.

---

## Análise Atual

O `SalesReportPanel.tsx` já possui:
- Período (DatePicker)
- Buscar (Input)
- Canal (Select: A010, BIO, LIVE)
- KPIs: Total Transações, Faturamento Bruto, Receita Líquida, Ticket Médio

**Falta adicionar:**
- Filtro de Fonte (Hubla/Make/Todos)
- Filtro de Closer (baseado em matching com agenda)
- Filtro de Pipeline (origin do CRM)

---

## Alterações no Arquivo

**`src/components/relatorios/SalesReportPanel.tsx`**

### 1. Novos Imports

```typescript
import { useGestorClosers } from '@/hooks/useGestorClosers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
```

### 2. Novos Estados

```typescript
const [selectedSource, setSelectedSource] = useState<string>('all');
const [selectedCloserId, setSelectedCloserId] = useState<string>('all');
const [selectedOriginId, setSelectedOriginId] = useState<string>('all');
```

### 3. Buscar Closers e Pipelines

```typescript
// Closers R1
const { data: closers = [] } = useGestorClosers('r1');

// Pipelines (origins)
const { data: origins = [] } = useQuery({
  queryKey: ['crm-origins-simple'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('crm_origins')
      .select('id, name, display_name')
      .eq('is_active', true);
    if (error) throw error;
    return (data || []).sort((a, b) => 
      (a.display_name || a.name).localeCompare(b.display_name || b.name)
    );
  },
});
```

### 4. Atualizar `filteredTransactions`

Adicionar lógica de filtro para:

```typescript
// Filtro por fonte (Hubla/Make)
if (selectedSource !== 'all') {
  filtered = filtered.filter(t => t.source === selectedSource);
}

// Filtro por pipeline (origin/categoria)
if (selectedOriginId !== 'all') {
  filtered = filtered.filter(t => t.product_category === selectedOriginId);
}
```

**Nota:** O filtro por Closer exigiria cruzar transações com a agenda, similar ao ContractReportPanel. Como as transações de vendas não têm vínculo direto com closers, esse filtro fará match via email/telefone com attendees.

### 5. Atualizar UI de Filtros

Layout completo:

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Período           │  Buscar              │  Fonte  │  Closer    │  Pipeline  │  Canal │ Excel│
│  [01/01 - 31/01]   │  [🔍 Nome, email...] │  [Todos]│ [Todos ▼]  │ [Todas ▼]  │ [Todos]│      │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6. KPIs Atualizadas

As 4 KPIs já calculam a partir de `filteredTransactions`, então automaticamente refletirão todos os filtros aplicados:
- Total Transações
- Faturamento Bruto
- Receita Líquida
- Ticket Médio

---

## Detalhes Técnicos

### Matching Closer com Transações

Como transações de vendas (Hubla) não têm `closer_id` direto, o matching será feito:

1. Buscar attendees `contract_paid` do período
2. Para cada transação, verificar se email ou telefone corresponde a algum attendee
3. Se sim, atribuir o closer do attendee àquela transação

```typescript
// Buscar attendees para matching
const { data: attendees = [] } = useQuery({
  queryKey: ['attendees-for-matching', dateRange],
  queryFn: async () => {
    const { data } = await supabase
      .from('meeting_slot_attendees')
      .select(`
        id, attendee_phone, deal_id,
        meeting_slots!inner(closer_id),
        crm_deals!deal_id(crm_contacts!contact_id(email, phone))
      `)
      .eq('status', 'contract_paid')
      .gte('contract_paid_at', dateRange.from?.toISOString());
    return data || [];
  },
  enabled: !!dateRange?.from,
});
```

### Filtrar por Closer

```typescript
if (selectedCloserId !== 'all') {
  const closerAttendees = attendees.filter(a => 
    a.meeting_slots?.closer_id === selectedCloserId
  );
  const closerEmails = new Set(closerAttendees.map(a => 
    a.crm_deals?.crm_contacts?.email?.toLowerCase()
  ).filter(Boolean));
  const closerPhones = new Set(closerAttendees.map(a => 
    normalizePhone(a.crm_deals?.crm_contacts?.phone)
  ).filter(Boolean));
  
  filtered = filtered.filter(t => 
    closerEmails.has(t.customer_email?.toLowerCase()) ||
    closerPhones.has(normalizePhone(t.customer_phone))
  );
}
```

---

## Resumo de Alterações

| Item | Mudança |
|------|---------|
| Imports | `useGestorClosers`, `useQuery`, `supabase` |
| Estados | `selectedSource`, `selectedCloserId`, `selectedOriginId` |
| Queries | Closers R1, Origins, Attendees para matching |
| Filtros | Fonte, Closer, Pipeline adicionados ao `filteredTransactions` |
| UI | 3 novos Selects na área de filtros |
| KPIs | Já dinâmicas (sem mudança adicional) |

---

## Resultado Visual Esperado

A aba de Vendas terá a mesma barra de filtros completa do Contratos:

```text
Período | Buscar | Fonte | Closer | Pipeline | Canal | [Exportar Excel]
```

KPIs que acompanham instantaneamente:
- Total Transações: 227 → filtra por A010 → 45
- Faturamento Bruto: R$ 2.280.143,28 → filtra por Closer X → R$ 150.000
- etc.
