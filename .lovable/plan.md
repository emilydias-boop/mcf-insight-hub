
# Corrigir constraint do banco: adicionar tipos consorcio_sdr_* na tabela team_targets

## Problema
A tabela `team_targets` possui um CHECK constraint (`team_targets_target_type_check`) que lista explicitamente os valores permitidos para a coluna `target_type`. Atualmente, apenas tipos `sdr_*` (Incorporador) estao na lista. Os novos tipos `consorcio_sdr_*` sao rejeitados pelo banco com erro 23514.

## Solucao
Criar uma migration SQL que:
1. Remove o constraint antigo (`team_targets_target_type_check`)
2. Recria o constraint incluindo todos os 30 novos tipos do Consorcio

## Detalhes Tecnicos

### Migration SQL
Executar `ALTER TABLE` para dropar e recriar o CHECK constraint, adicionando os seguintes tipos:

```text
consorcio_sdr_agendamento_dia
consorcio_sdr_agendamento_semana
consorcio_sdr_agendamento_mes
consorcio_sdr_r1_agendada_dia
consorcio_sdr_r1_agendada_semana
consorcio_sdr_r1_agendada_mes
consorcio_sdr_r1_realizada_dia
consorcio_sdr_r1_realizada_semana
consorcio_sdr_r1_realizada_mes
consorcio_sdr_noshow_dia
consorcio_sdr_noshow_semana
consorcio_sdr_noshow_mes
consorcio_sdr_proposta_enviada_dia
consorcio_sdr_proposta_enviada_semana
consorcio_sdr_proposta_enviada_mes
consorcio_sdr_contrato_dia
consorcio_sdr_contrato_semana
consorcio_sdr_contrato_mes
consorcio_sdr_aguardando_doc_dia
consorcio_sdr_aguardando_doc_semana
consorcio_sdr_aguardando_doc_mes
consorcio_sdr_carta_fechada_dia
consorcio_sdr_carta_fechada_semana
consorcio_sdr_carta_fechada_mes
consorcio_sdr_aporte_dia
consorcio_sdr_aporte_semana
consorcio_sdr_aporte_mes
consorcio_sdr_venda_realizada_dia
consorcio_sdr_venda_realizada_semana
consorcio_sdr_venda_realizada_mes
```

Todos os tipos existentes (`sdr_*`, `ultrameta_*`, `setor_*`, etc.) serao mantidos -- apenas adicionamos os novos.

### Resultado
- Metas do Consorcio poderao ser salvas no banco sem erro
- Nenhuma alteracao de codigo necessaria (o fix anterior do upsert ja esta correto)
- Dados existentes do Incorporador nao sao afetados
