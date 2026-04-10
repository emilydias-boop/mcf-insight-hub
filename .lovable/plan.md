

# Encaixar no Carrinho — Mover para Aprovados da semana atual

## Problema
O botão "Encaixar" abre um modal de agendamento, mas o lead já tem R2 realizada com status Aprovado. O que falta é fazer esse lead **aparecer na aba Aprovados da semana atual**, sem criar nova reunião.

O problema técnico: a aba Aprovados filtra por `scheduled_at` dentro da janela da semana. Leads de semanas anteriores caem fora dessa janela, mesmo sendo Aprovados.

## Solução
Adicionar uma coluna `carrinho_week_start` (date) em `meeting_slot_attendees`. Quando preenchida, força o attendee a aparecer no carrinho daquela semana. O botão "Encaixar" faz um UPDATE direto nessa coluna — sem modal, sem re-agendar.

## Alterações

### 1. Migration: nova coluna
```sql
ALTER TABLE meeting_slot_attendees ADD COLUMN carrinho_week_start date;
```

### 2. Novo hook `useEncaixarNoCarrinho`
- Mutation: `UPDATE meeting_slot_attendees SET carrinho_week_start = weekStart WHERE id = attendeeId`
- Invalidate queries: `r2-carrinho-data`, `r2-carrinho-kpis`, `r2-accumulated-leads`

### 3. Ajustar `useR2CarrinhoData`
- Fazer uma segunda query buscando attendees onde `carrinho_week_start = weekStart` (data da quinta)
- Fazer merge com os resultados da query principal (evitando duplicatas por `id`)
- Assim leads encaixados aparecem em Todas R2s e Aprovados

### 4. Ajustar `useR2CarrinhoKPIs`
- Mesma lógica: incluir attendees com `carrinho_week_start` nos contadores

### 5. Ajustar `useR2AccumulatedLeads`
- Excluir leads que já têm `carrinho_week_start` >= semana atual (para não duplicar)

### 6. Ajustar `R2AccumulatedList` + `R2Carrinho`
- Para leads **com meeting existente** (têm `meeting_id`): botão "Encaixar" faz update direto (one-click, sem modal)
- Para leads **sem R2** (sem `meeting_id`): botão "Agendar R2" mantém o modal atual
- Loading state no botão durante a mutation

## Fluxo do usuário
1. Abre aba "Acumulados"
2. Vê "João Marcos zenni" — status Aprovado, semana anterior
3. Clica "Encaixar" → update instantâneo
4. Lead desaparece dos Acumulados e aparece na aba Aprovados da semana atual

## Arquivos
- Migration SQL (nova coluna)
- `src/hooks/useEncaixarNoCarrinho.ts` (novo)
- `src/hooks/useR2CarrinhoData.ts`
- `src/hooks/useR2CarrinhoKPIs.ts`
- `src/hooks/useR2AccumulatedLeads.ts`
- `src/components/crm/R2AccumulatedList.tsx`
- `src/pages/crm/R2Carrinho.tsx`

