

## O que está acontecendo com o horário

### Resumo

Os horários na tela de Vendas (Transações) já estão em **horário de Brasília (BRT)**. O Samuel aparece como `00:15` — isso é meia-noite e quinze em Brasília. No banco de dados, esse valor é armazenado como `03:15 UTC` (3 horas a mais).

O sistema de métricas (`useR1CloserMetrics`) já faz a conversão correta adicionando 3 horas ao filtro de data:
- Dia 23/03 BRT = `23/03 03:00 UTC` até `24/03 02:59 UTC`

### Por que Samuel e Carlos são Outside

| Lead | Horário pagamento (BRT) | Horário reunião (BRT) | Outside? |
|------|------------------------|----------------------|----------|
| Samuel | 00:15 | 14:00 | Sim (14h antes) |
| Carlos | 13:07 | 16:20 | Sim (3h antes) |

Ambos pagaram **antes** do horário da reunião no mesmo dia. Pela regra que você confirmou ("antes da reunião = Outside"), isso está correto.

### Contagem esperada após a migration

A migration que vinculou Samuel e Carlos já foi executada. Ao recarregar a página:

| KPI | Antes | Depois |
|-----|-------|--------|
| Contratos | 9 | 9 (sem mudança) |
| Outside | 1 | 3 (+Samuel +Carlos) |
| Total visível | 10 | 12 |

A Claudia Pinheiro (2/12, recorrente) não conta como contrato novo — correto.

### Nenhuma mudança de código necessária

O UTC está sendo tratado corretamente no código. A conversão BRT (+3h) já existe no `useR1CloserMetrics` (linha 46-48). Os horários mostrados na tela de transações já são BRT (convertidos pelo navegador automaticamente).

Se quiser, posso verificar na página de reuniões se os números já atualizaram após a migration.

