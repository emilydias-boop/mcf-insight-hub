
# Plano: Corrigir Contagem de R2 Agendadas por Closer R1

## Problema Identificado

A coluna **"R2 Agendada"** na tabela de Closers está mostrando **0** para todos, quando deveria mostrar:

| Closer | R2 Agendadas (real) | Exibido |
|--------|---------------------|---------|
| Julio | 61 | 0 |
| Cristiane | 51 | 0 |
| Thayna | 48 | 0 |

## Causa Raiz

No hook `useR1CloserMetrics.ts`, a busca de **reuniões R1** está filtrada pelo mesmo período de datas selecionado na página:

```typescript
// Linhas 58-59 - PROBLEMA
.gte('scheduled_at', start)  // Filtra R1 para o período
.lte('scheduled_at', end)    // Ex: apenas janeiro/2026
```

Mas uma **R2 de janeiro** pode estar vinculada a uma **R1 de dezembro**!

**Resultado:** O mapeamento `deal_id → closer_id` fica incompleto, não encontrando correspondência para R2s cujas R1 foram realizadas antes do período filtrado.

## Solução

Separar as queries em duas lógicas:

1. **Para métricas R1** (agendadas, realizadas, no-show, contrato): manter o filtro de data (período selecionado)

2. **Para mapeamento R2 → Closer R1**: buscar **todas as R1** independente de data, já que o vínculo é pelo `deal_id`

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useR1CloserMetrics.ts` | Separar query de R1 para métricas vs query para mapeamento R2 |

## Mudanças no Código

### useR1CloserMetrics.ts

**Adicionar uma segunda query de R1 SEM filtro de data** para mapear deals a closers:

```text
1. Query R1 PARA O PERÍODO (já existe)
   → Usada para: r1_agendada, r1_realizada, noshow, contrato_pago
   
2. NOVA: Query R1 SEM FILTRO DE DATA
   → Usada apenas para: dealToR1Closer map (atribuição R2)
   
3. Query R2 PARA O PERÍODO (já existe)
   → Usa o map da query 2 para atribuir R2 ao closer R1
```

### Implementação

Na query que popula o `dealToR1Closer`, remover os filtros de data:

```typescript
// NOVA query: Buscar TODOS os R1 meetings para mapear deal → closer R1
const { data: allR1Meetings } = await supabase
  .from('meeting_slots')
  .select(`
    closer_id,
    meeting_slot_attendees (
      deal_id,
      booked_by,
      status
    )
  `)
  .eq('meeting_type', 'r1')
  .neq('status', 'cancelled')
  .neq('status', 'canceled');
  // SEM filtro de data!

// Usar allR1Meetings para construir dealToR1Closer
const dealToR1Closer = new Map<string, string>();
allR1Meetings?.forEach(meeting => {
  meeting.meeting_slot_attendees?.forEach(att => {
    if (att.deal_id && meeting.closer_id) {
      const bookedByEmail = att.booked_by ? profileEmailMap.get(att.booked_by) : null;
      if (bookedByEmail && validSdrEmails.has(bookedByEmail)) {
        // Mapear deal → R1 closer (primeira correspondência ganha)
        if (!dealToR1Closer.has(att.deal_id)) {
          dealToR1Closer.set(att.deal_id, meeting.closer_id);
        }
      }
    }
  });
});
```

## Fluxo de Implementação

```text
1. Adicionar query de R1 sem filtro de data
          ↓
2. Buscar profiles para essa nova query (ou reutilizar)
          ↓
3. Construir dealToR1Closer usando a query sem filtro
          ↓
4. Manter lógica de contagem R2 inalterada
          ↓
5. Testar com período de janeiro/2026
```

## Resultado Esperado

| Closer | Antes | Depois |
|--------|-------|--------|
| Julio | 0 | 61 |
| Cristiane | 0 | 51 |
| Thayna | 0 | 48 |
| **Total** | 0 | **160** |

## Impacto

- Corrige a exibição de R2 Agendadas na tabela de Closers
- Não afeta outras métricas (R1 Agendada, Realizada, etc.)
- Não impacta performance significativamente (query adicional simples)
