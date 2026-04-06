

# Corrigir metricas de Closer no Painel Consorcio

## Diagnostico

Dois problemas distintos causam os numeros errados na aba Closers:

### Problema 1: Outside detection incorreta (causa principal da diferenca 321→196)

O hook `useR1CloserMetrics` exclui leads "outside" das metricas de R1 Agendada/Realizada/No-show (linhas 500-504). A deteccao de outside busca transacoes na `hubla_transactions` com filtro:
```
product_category IN ('contrato', 'incorporador')
product_name LIKE '%contrato%'
```
Esse filtro e especifico do **incorporador** ("A000 - Contrato", "Contrato - Socio MCF"), mas e aplicado igualmente para closers de **consorcio**. Resultado: 106+ leads de consorcio que tambem compraram produto incorporador sao incorretamente excluidos como "outside".

- Dados reais no banco: **321 agendadas, 244 realizadas, 75 no-shows** (sem exclusao)
- Apos exclusao outside: **196 agendadas, 143 realizadas, 51 no-shows** (o que aparece na tela)

### Problema 2: Proposta Enviada mostra 0 para closers

Na linha 766 do PainelEquipe, `propostasEnviadasByCloser` recebe `propostasData` que vem de `useConsorcioPipelineMetricsBySdr` — retorna `Map<sdrEmail, count>`. Como as chaves sao emails de SDR e nao IDs de closer, o componente `ConsorcioCloserSummaryTable` nunca encontra match.

## Alteracoes

### 1. `src/hooks/useR1CloserMetrics.ts` — Condicionar outside por BU

O outside detection so faz sentido para `bu === 'incorporador'`. Para consorcio, o conceito de "outside" (lead comprou contrato incorporador antes da reuniao) nao se aplica.

- Quando `bu !== 'incorporador'`: pular toda a logica de outside (emailContractDate, outsideByCloser, etc.)
- Setar `isOutsideLead = false` no loop de processamento de attendees
- Isso restaura os numeros corretos: 321 agendadas, 244 realizadas, 75 no-shows

### 2. `src/pages/bu-consorcio/PainelEquipe.tsx` — Criar hook de propostas enviadas por closer

- Criar ou usar um hook `useConsorcioPipelineMetricsByCloser(start, end)` que retorne `Map<closerId, count>` (similar ao que existe para SDR mas com join via meeting_slot_attendees)
- Passar o resultado correto para `propostasEnviadasByCloser`

Alternativa mais simples: como nao existe um hook dedicado e a feature de "proposta enviada por closer" pode nao ter dados, criar o hook `useConsorcioPipelineMetricsByCloser` seguindo o mesmo padrao de `useConsorcioProdutosFechadosByCloser` mas consultando `deal_activities` com `to_stage` contendo "proposta" ou similar.

### 3. `src/hooks/useConsorcioPipelineMetricsByCloser.ts` (novo arquivo)

Hook que conta propostas enviadas por closer:
- Query `deal_activities` com `activity_type = 'stage_change'` e `to_stage` contendo "Proposta" no periodo
- Join via `deal_id → meeting_slot_attendees → meeting_slots.closer_id`
- Retorna `Map<closerId, count>`

## Arquivos alterados
1. `src/hooks/useR1CloserMetrics.ts` — condicionar outside por BU
2. `src/pages/bu-consorcio/PainelEquipe.tsx` — usar hook correto para propostas by closer
3. `src/hooks/useConsorcioPipelineMetricsByCloser.ts` — novo hook

## Resultado esperado
- Closer tab mostrara: ~321 R1 Agendada, ~244 R1 Realizada, ~75 No-show (alinhado com SDR)
- Proposta Env. e Proposta Fech. mostrarao valores reais por closer

