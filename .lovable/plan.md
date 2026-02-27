

## Problema

O KPI "Reuniões Agendadas" (e "Contratos Pagos") usa **snapshot do stage atual** dos deals:

```
crm_deals WHERE stage = 'Reunião 01 Agendada' AND created_at no período
```

Deals que já passaram por "R1 Agendada" mas avançaram para "R1 Realizada", "Contrato Pago", etc. **não são contados**. O número real é muito maior.

## Solução

Trocar a fonte de dados para `deal_activities` (movimentações históricas), contando deals que **passaram** por cada stage no período, não apenas os que estão lá agora.

### Alteração em `src/components/crm/FunilDashboard.tsx`

Substituir as queries de `agendadas` e `contratos` (linhas 111-122) por queries em `deal_activities`:

```typescript
// Reuniões Agendadas: deals que PASSARAM por R1 Agendada no período
supabase.from('deal_activities')
  .select('deal_id')
  .in('activity_type', ['stage_change', 'stage_changed'])
  .ilike('to_stage', '%Reunião 01 Agendada%')
  .gte('created_at', periodStart.toISOString())
  .lte('created_at', periodEnd.toISOString())

// Contratos Pagos: deals que PASSARAM por Contrato Pago no período
supabase.from('deal_activities')
  .select('deal_id')
  .in('activity_type', ['stage_change', 'stage_changed'])
  .ilike('to_stage', '%Contrato Pago%')
  .gte('created_at', periodStart.toISOString())
  .lte('created_at', periodEnd.toISOString())
```

Deduplicar por `deal_id` no JS (usar `new Set(data.map(d => d.deal_id)).size`) para contar deals únicos.

Aplicar a mesma correção para as queries do **período anterior** (linhas 149-160).

