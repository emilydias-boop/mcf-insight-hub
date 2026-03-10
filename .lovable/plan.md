

## Diagnóstico: R2 Agendadas no Fechamento do Closer

### O que está acontecendo

O card "R2 Agendadas" no fechamento mostra **0** porque existem **3 problemas encadeados**:

### Problema 1: `useCloserAgendaMetrics` não retorna `r2_agendadas`

O hook `useCloserAgendaMetrics` (usado no Detail.tsx para closers) retorna apenas:
- `r1_alocadas`, `r1_realizadas`, `contratos_pagos`, `no_shows`, `vendas_parceria`

**Não tem campo `r2_agendadas`**. Nunca busca reuniões R2 do closer.

### Problema 2: `useSdrAgendaMetricsBySdrId` também não retorna `r2_agendadas`

O hook usado no `KpiEditForm` chama a RPC `get_sdr_metrics_from_agenda` e retorna:
- `agendamentos`, `r1_agendada`, `r1_realizada`, `no_shows`, `contratos`, `vendas_parceria`

Também **sem `r2_agendadas`**. A interface `SdrAgendaMetricsById` nem tem esse campo.

### Problema 3: `DynamicIndicatorCard` busca `kpi.r2_agendadas` que nunca é populado

O `METRIC_CONFIG` para `r2_agendadas` aponta para `kpiField: 'r2_agendadas'`, mas a tabela `sdr_month_kpi` não tem esse campo. E o `useSdrFechamento` retorna `realizado: 0` com um `// TODO`.

### Fluxo do dado que falta

O que o card "R2 Agendadas" precisa: contar quantas reuniões R2 foram agendadas para leads atendidos por este closer no R1. Essa informação existe na tabela `meeting_slots` com `meeting_type = 'r2'`.

### Correção

**`src/hooks/useCloserAgendaMetrics.ts`**:
- Adicionar campo `r2_agendadas` à interface `CloserAgendaMetrics`
- Buscar `meeting_slots` com `meeting_type = 'r2'` onde o lead teve R1 com este closer (via `meeting_slot_attendees` → `deal_id` → R1 slot do closer), OU mais simples: contar R2 slots deste closer diretamente se o closer faz R2 também

**`src/hooks/useSdrAgendaMetricsBySdrId.ts`**:
- Adicionar `r2_agendadas` à interface `SdrAgendaMetricsById`
- Buscar contagem de R2 agendadas para o closer (reuniões R2 onde os leads vieram do R1 deste closer)

**`src/components/sdr-fechamento/KpiEditForm.tsx`**:
- Exibir o campo R2 Agendadas no formulário do Closer (atualmente não existe)
- Mostrar o valor automático da agenda

**`src/hooks/useSdrFechamento.ts`** (linha 501-508):
- Substituir o `TODO` por lógica real que usa o valor do hook

**`src/components/fechamento/CloserIndicators.tsx`** (linha 120-139):
- Substituir o placeholder ("-") pelo valor real de `r2_agendadas`

A questão principal é **de onde vem o R2 do closer**: se o closer faz R1 E R2, basta contar `meeting_slots` com `meeting_type = 'r2'` e `closer_id = X`. Se o R2 é atribuído ao closer que fez o R1 (outro closer faz o R2), precisa rastrear pelo `deal_id`.

Baseado no código existente (`useR1CloserMetrics` linha 127-128: "R2 is attributed to the closer who did the R1 for the same deal"), a lógica correta é: contar reuniões R2 cujos leads tiveram R1 com este closer.

### Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useCloserAgendaMetrics.ts` | Adicionar busca de R2 agendadas (por deal_id dos attendees do closer) |
| `src/hooks/useSdrAgendaMetricsBySdrId.ts` | Adicionar `r2_agendadas` ao retorno |
| `src/components/sdr-fechamento/KpiEditForm.tsx` | Exibir campo R2 Agendadas para Closers |
| `src/components/fechamento/CloserIndicators.tsx` | Usar valor real em vez de placeholder |
| `src/hooks/useSdrFechamento.ts` | Remover TODO e usar valor real |

