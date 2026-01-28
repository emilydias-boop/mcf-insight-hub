

# Identificação de Vendas "Extras" no Carrinho R2

## Problema Identificado

Leads como o **Brayan Guedes Rossato** tiveram sua R2 em uma semana (22/01 - semana 17-23/01), mas só pagaram em outra semana (28/01 - semana 24-30/01). Atualmente:

1. A venda aparece no Carrinho R2 da semana 24-30/01 (por causa do match manual via `linked_attendee_id`)
2. Isso infla artificialmente as métricas de vendas da semana atual
3. Distorce a conversão real do time para a semana em questão

## Solução Proposta

### 1. Identificar automaticamente se uma venda é "Extra"

Uma venda é **Extra** quando:
- O attendee vinculado (via email, telefone ou `linked_attendee_id`) teve sua R2 agendada em uma **semana diferente** da semana do carrinho atual

### 2. Adicionar flag `is_extra` ao tipo `R2CarrinhoVenda`

```typescript
export interface R2CarrinhoVenda {
  // ... campos existentes ...
  
  // Flag para vendas de semanas anteriores
  is_extra: boolean;
  original_week_start?: string; // Data de início da semana original
  original_scheduled_at?: string; // Data da R2 original
}
```

### 3. Modificar o hook `useR2CarrinhoVendas`

Quando buscar os attendees vinculados, também buscar a data da R2 (`scheduled_at`) para comparar com a semana atual:

```text
Para cada transação matched:
  1. Verificar scheduled_at do attendee vinculado
  2. Calcular weekStart e weekEnd do attendee
  3. Se weekStart do attendee ≠ weekStart atual:
     → is_extra = true
     → original_week_start = weekStart do attendee
```

### 4. UI: Badge visual "Extra" nas transações

Na tabela de vendas (`R2VendasList.tsx`), exibir um badge laranja indicando vendas extras:

```text
| Data       | Produto              | Cliente            | ... | Fonte |
|------------|----------------------|-------------------|-----|-------|
| 28/01/2026 | A009 - MCF INCORP... | Brayan Rossato    | ... | Make  🔗 Manual  ⚡ Extra (22/01) |
```

### 5. Métricas separadas

No `R2MetricsPanel` e nos totais, separar:
- **Vendas da Semana**: Leads que fizeram R2 esta semana e compraram
- **Vendas Extras**: Leads de outras semanas que compraram esta semana

```text
+-------------------+---------------+----------------+
| Vendas da Semana  | Vendas Extras | Total Vendas   |
|        5          |       1       |       6        |
+-------------------+---------------+----------------+
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useR2CarrinhoVendas.ts` | Adicionar lógica para identificar `is_extra` comparando datas |
| `src/components/crm/R2VendasList.tsx` | Adicionar badge visual "Extra" e separar contagem |
| `src/hooks/useR2MetricsData.ts` | Separar métricas de vendas extras vs. normais |

---

## Detalhes de Implementação

### Lógica no `useR2CarrinhoVendas.ts`

```typescript
// Ao buscar linkedAttendees, também buscar scheduled_at
const { data: linkedAttendees } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    id,
    attendee_name,
    meeting_slot:meeting_slots!inner (
      scheduled_at,  // ← ADICIONAR
      closer:closers (name, color)
    )
  `)
  .in('id', linkedAttendeeIds);

// Ao criar a venda matched, calcular is_extra
const attendeeScheduledAt = linkedData?.scheduledAt;
const attendeeWeekStart = attendeeScheduledAt 
  ? getCustomWeekStart(new Date(attendeeScheduledAt)) 
  : null;

const isExtra = attendeeWeekStart 
  && attendeeWeekStart.getTime() !== weekStart.getTime();

matchedTransactions.push({
  ...transactionData,
  is_extra: isExtra,
  original_week_start: isExtra ? format(attendeeWeekStart, 'yyyy-MM-dd') : undefined,
  original_scheduled_at: attendeeScheduledAt,
});
```

### UI no `R2VendasList.tsx`

```tsx
{/* Na coluna Fonte */}
{venda.is_extra && (
  <Badge variant="outline" className="text-orange-500 border-orange-500/50 bg-orange-500/10">
    ⚡ Extra ({format(new Date(venda.original_scheduled_at!), 'dd/MM')})
  </Badge>
)}

{/* Nos totais */}
const vendasNormais = vendas.filter(v => !v.is_extra && !v.excluded_from_cart);
const vendasExtras = vendas.filter(v => v.is_extra && !v.excluded_from_cart);
```

---

## Resultado Esperado

### Antes (confuso)
```
Vendas: 1 transação de R$ 19.500,00
→ Parece que o time fechou 1 venda esta semana
```

### Depois (claro)
```
Vendas da Semana: 0  |  Extras: 1 (Brayan - R2 em 22/01)  |  Total: 1
→ Claro que o Brayan era de outra semana e fechou agora
```

---

## Impacto nas Métricas

| Métrica | Antes | Depois |
|---------|-------|--------|
| Conversão Semanal | Inflada por extras | Reflete só a semana atual |
| Performance Closer | Misturado | Separado por semana real |
| Relatórios | Confusos | Transparentes |

