
# Filtro de Closers R1 - Atribuição Total de Vendas

## Objetivo

Modificar o filtro de Closer na página de Transações para:
1. Mostrar **apenas closers de R1** (Julio, Cristiane Gomes, Thayna)
2. Atribuir **TODAS as vendas** ao closer R1 que atendeu o lead (A000, A010, A001, A009, Order Bumps, etc.)
3. Contabilizar o valor bruto total no período para cada closer R1

## Cenário de Uso

Quando um lead passa por uma R1 com um closer e depois compra qualquer produto:

| Produto | Descrição | Atribuição |
|---------|-----------|------------|
| A000 | Contrato R$ 497 | Closer R1 |
| A010 | Consultoria Construa para Vender | Closer R1 |
| A001 | Incorporador Completo | Closer R1 |
| A009 | Incorporador + Club | Closer R1 |
| Order Bumps | Produtos adicionais na compra | Closer R1 |
| Qualquer outro | P2, extras | Closer R1 |

## Alterações Técnicas

### Arquivo: `src/pages/bu-incorporador/TransacoesIncorp.tsx`

#### 1. Filtrar apenas closers R1

```typescript
// Linha 65 - Mudar de:
const { data: closers = [] } = useGestorClosers();

// Para:
const { data: closers = [] } = useGestorClosers('r1');
```

#### 2. Expandir query de attendees para buscar TODOS os R1

A query atual só busca `status = 'contract_paid'`. Precisamos buscar **todos os attendees de R1** (scheduled, completed, contract_paid) para capturar leads que compraram sem necessariamente ter "contract_paid":

```typescript
// Linhas 89-108 - Substituir query por:
const { data: attendees = [] } = useQuery({
  queryKey: ['r1-attendees-for-matching', startDate?.toISOString(), endDate?.toISOString()],
  queryFn: async () => {
    if (!startDate) return [];
    
    // Buscar período expandido (30 dias antes) para capturar leads
    // que fizeram R1 antes e compraram no período
    const expandedStart = new Date(startDate);
    expandedStart.setDate(expandedStart.getDate() - 30);
    
    const { data, error } = await supabase
      .from('meeting_slot_attendees')
      .select(`
        id, 
        attendee_phone, 
        deal_id,
        meeting_slots!inner(closer_id, meeting_type),
        crm_deals!deal_id(crm_contacts!contact_id(email, phone))
      `)
      .eq('meeting_slots.meeting_type', 'r1')
      .gte('meeting_slots.scheduled_at', expandedStart.toISOString())
      .in('status', ['scheduled', 'invited', 'completed', 'contract_paid', 'rescheduled', 'no_show']);
    
    if (error) throw error;
    return data || [];
  },
  enabled: !!startDate,
});
```

## Por que expandir 30 dias antes?

Um lead pode:
1. Fazer R1 com Julio em 10/01
2. Comprar A001 em 05/02

Ao filtrar Fevereiro, precisamos buscar R1s de Janeiro para fazer o matching corretamente.

## Resultado Esperado

### Exemplo Prático

**Lead João:**
- 15/01: Fez R1 com **Julio**
- 20/01: Comprou **A000** (Contrato R$ 497)
- 25/01: Fez R2 com Jessica
- 30/01: Comprou **A009** (R$ 19.500)
- 30/01: Comprou **Order Bump A010** (R$ 47)

**Ao filtrar por "Julio" em Janeiro:**

| Produto | Valor |
|---------|-------|
| A000 (Contrato) | R$ 497 |
| A009 (Incorporador + Club) | R$ 19.500 |
| A010 (Order Bump) | R$ 47 |
| **Total Bruto** | **R$ 20.044** |

Todas as vendas do João são atribuídas ao Julio (closer R1), independente do tipo de produto.

## Arquivos a Modificar

1. **`src/pages/bu-incorporador/TransacoesIncorp.tsx`**:
   - Linha 65: Mudar `useGestorClosers()` → `useGestorClosers('r1')`
   - Linhas 89-108: Expandir query de attendees para buscar todos R1 (não apenas contract_paid)
