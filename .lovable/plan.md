## Problema: R2 Agendadas e Vendas Parceria zeradas no KPI Form do Closer

### Causa raiz

O `KpiEditForm` usa internamente `useSdrAgendaMetricsBySdrId` (linha 65) que chama o RPC `get_sdr_metrics_from_agenda`. Este RPC retorna **vazio** para Closers (confirmado no network request: `{"metrics": []}`), porque closers não são SDRs no sistema de agenda.

O Detail.tsx já busca os dados corretos via `useCloserAgendaMetrics` e usa esses valores para montar o `effectiveKpi`, mas **não passa esses dados para o formulário**. O formulário exibe `agendaMetrics.data?.r2_agendadas` (sempre 0) e `vendasParceria` (passado como prop, mas vem de outra fonte que também pode estar zerada).

### Solução

Passar os dados do `closerMetrics` para o `KpiEditForm` como prop opcional, e quando presente, usar esses valores em vez do hook interno de SDR.


| #   | Arquivo           | Mudança                                                                                                                                                                                                                     |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `KpiEditForm.tsx` | Adicionar prop `closerAgendaMetrics?: { r1_realizadas, contratos_pagos, no_shows, vendas_parceria, r2_agendadas }`. Quando presente (closer), usar estes valores nos campos auto-preenchidos em vez de `agendaMetrics.data` |
| 2   | `Detail.tsx`      | Passar `closerAgendaMetrics={closerMetrics.data}` para o `KpiEditForm` quando `isCloser`                                                                                                                                    |


### Resultado esperado

- R2 Agendadas: mostra o valor real da agenda do closer (ex: 50)
- Vendas Parceria: mostra o valor real das transações de parceria
- Os campos auto-preenchidos (Realizadas, No-Shows, Contratos) também passam a usar a fonte correta