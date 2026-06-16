# Classificação avançada de ligações no painel "Atividades por SDR"

## Objetivo

Hoje o painel mostra apenas **Total** e **Atendidas**. Vamos quebrar isso em categorias acionáveis para identificar prospecção saudável vs. discagem improdutiva.

## Faixas de classificação (heurística por duração)

Aplicadas **apenas** a chamadas `direction='outbound'`:

| Categoria | Critério | Significado |
|---|---|---|
| **Não atendida** | `status` em `no-answer`, `failed`, `busy`, `initiated` (ou `duration_seconds = 0`) | Não tocou ou tocou e ninguém atendeu |
| **Ring drop** | `status='completed'` e `1 ≤ duration ≤ 10s` | Atendeu e desligou rápido (rejeitou) |
| **Provável caixa postal** | `status='completed'` e `11 ≤ duration ≤ 30s` | Provavelmente bateu o áudio da caixa postal |
| **Efetiva** | `status='completed'` e `31 ≤ duration ≤ 60s` | Falou, mas conversa curta |
| **Qualificada** | `status='completed'` e `duration > 60s` | Conversa de prospecção real |

> Limitação assumida: como o AMD do Twilio está desligado (`answered_by` sempre NULL), a separação caixa postal × ring drop × efetiva é **heurística**. O código fica preparado para usar `answered_by` se um dia o AMD for ligado.

## Mudanças

### 1. `src/hooks/useSdrActivityMetrics.ts`
- Adicionar ao `SELECT` de `calls` os campos `duration_seconds` e `answered_by`.
- Adicionar à interface `SdrActivityMetrics` os campos:
  `notAnsweredCalls`, `ringDropCalls`, `voicemailCalls`, `effectiveCalls`, `qualifiedCalls`, `connectionRate` (= (ringDrop+voicemail+effective+qualified)/total), `qualificationRate` (= qualified/total).
- Função pura `classifyCall(status, duration, answeredBy)` que retorna uma das 5 categorias, priorizando `answered_by` quando presente (`machine_start`/`fax` → voicemail, `human` → effective/qualified pela duração).
- Manter `answeredCalls` por compatibilidade = ringDrop + voicemail + effective + qualified.

### 2. `src/components/sdr/SdrActivityMetricsTable.tsx`
- Substituir as colunas atuais `Total | Atendidas | Notas | Stage | WhatsApp | Leads | Média` por:
  `SDR | Total | Não atend. | Ring drop | Caixa postal | Efetivas | Qualificadas | Taxa conexão | Taxa qualificação | Notas | Stage | WA | Leads | Média`.
- Codificação visual: ring drop e caixa postal em cinza/âmbar; efetivas em azul; qualificadas em verde destacado.
- Linha de Totais somando todas as colunas numéricas.
- Tooltip no header de cada categoria explicando a faixa (ex.: "Ring drop: atendida e encerrada em até 10s").
- Card de legenda no topo da tabela com as 5 faixas.

### 3. Escopo cross-BU
O hook `useSdrActivityMetrics` já recebe `squad` como parâmetro e o componente já é genérico. Vou:
- Buscar todos os call sites com `rg "SdrActivityMetricsTable|useSdrActivityMetrics"` para garantir que cada BU (Incorporador, Consórcio, etc.) consome o mesmo componente — se algum BU tiver versão duplicada, unificar para usar este componente único.

### 4. Sem mudanças de schema
Não precisa migration: `duration_seconds`, `status` e `answered_by` já existem em `public.calls`. Nada novo no banco.

## Validação

- Rodar query de sanidade após deploy comparando: `totalCalls = notAnswered + ringDrop + voicemail + effective + qualified` por SDR.
- Verificar visualmente em `/bu-incorporador/relatorios` (Painel Comercial) que as somas batem com o total atual.
- Spot-check: pegar 3 SDRs e cruzar com a aba de gravações no CRM para confirmar que ligações classificadas como "Qualificada" realmente têm conversa.

## Riscos / observações

- As faixas (10s/30s/60s) são um chute inicial razoável baseado no que vi nos dados (média atual de `completed` = 14s, ou seja **a maior parte do que hoje contamos como "atendida" provavelmente é ring drop ou caixa postal**). Após a primeira semana de uso, podemos calibrar.
- Se quiser precisão real de caixa postal, o próximo passo é ativar AMD no Twilio (+~US$0.0075/chamada) — o código já vai estar preparado.
