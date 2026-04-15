

## Diagnóstico

A query R2 no hook exclui attendees com `status = 'pre_scheduled'` (linha 129). Isso oculta 5 leads que **já têm R2 marcada** mas ainda estão em status pré-agendado — como o caso do "Riolando de Faria Gião Jr" que tem R2 com Jessica Martins em 16/04.

A exclusão de `pre_scheduled` faz sentido nas grids de agenda (para não poluir), mas no relatório de lifecycle o objetivo é justamente ver se o lead **tem ou não R2**, independente do status de confirmação.

## Correção

**`src/hooks/useContractLifecycleReport.ts`** — uma única alteração:

- **Remover** `.neq('status', 'pre_scheduled')` da query R2 (linha 129)
- Isso vai incluir os 5 leads que hoje aparecem como "Sem R2" mas na verdade já têm R2 pré-agendada
- O campo `r2AttendeeStatus` já captura o status do attendee, então a coluna "Presença R2" vai mostrar corretamente "Pré-agendado" para esses casos

Nenhuma outra alteração necessária — o painel já renderiza `r2AttendeeStatus` na coluna de presença.

