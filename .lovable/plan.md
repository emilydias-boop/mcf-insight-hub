

## Auto-detecção de Pré-Agendamento por Closer R1

### Contexto
Hoje o toggle "Pré-agendamento" no modal é 100% manual. O usuário quer que, ao selecionar o "Responsável pelo agendamento" (bookedBy), o sistema detecte automaticamente se é um Closer R1 e ative o pré-agendamento. O toggle continua visível como override.

### Lógica
1. Quando o booker é selecionado no modal, buscar seu email na tabela `profiles`
2. Verificar se esse email existe na tabela `closers` com `meeting_type = 'r1'` (ou `meeting_type IS NULL`, que também indica R1)
3. Se sim → ativar `isPreSchedule` automaticamente
4. O toggle continua disponível para override manual (forçar pré-agendamento ou desativar)

### Mudanças

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useR2Bookers.ts` | Adicionar campo `is_r1_closer` ao retorno, fazendo join com `closers` via email |
| `src/components/crm/R2QuickScheduleModal.tsx` | Quando `bookedBy` muda, verificar se o booker é R1 closer e auto-setar `isPreSchedule`. Mostrar indicador visual "Closer R1 detectado" junto ao toggle |

### Detalhes técnicos

**useR2Bookers.ts**: Buscar `profiles` com `can_book_r2 = true`, depois fazer segunda query em `closers` para verificar quais emails são R1 closers. Retornar `{ id, nome, isR1Closer }`.

**R2QuickScheduleModal.tsx**: `useEffect` no `bookedBy` que, ao mudar, busca o booker na lista e se `isR1Closer === true`, seta `setIsPreSchedule(true)`. Se não for R1, seta `false`. Label do toggle mostra "(auto: Closer R1)" quando auto-detectado.

### Slots e capacidade
Os pré-agendados já ocupam capacidade (o `useR2CloserAvailableSlots` conta `meeting_slots` com status `scheduled`/`rescheduled`, e o slot é criado com status `scheduled` independente de ser pré-agendamento). Isso já está funcionando corretamente — o horário fica indisponível para outros.

