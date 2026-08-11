# Migração total do discador para Sonax (fim do Twilio)

Decisão confirmada: toda discagem (avulsa e em sequência) passa a rodar em Sonax. O Twilio sai do
caminho de discagem. Perda aceita: sem duração/atendida automática — a efetividade passa a vir de
outcome manual do SDR.

## 1. Motor de discagem (Auto-Discador)

Hoje `AutoDialerContext.tsx` é dirigido pelo `callStatus` do Twilio WebRTC: `dialIndex` chama
`useTwilio().makeCall`, e um `useEffect` reage a `ringing → in-progress → completed/failed` para
decidir atender/retry/avançar. Com Sonax não existe nenhum desses eventos no navegador.

Reescrita:

- `dialIndex(idx)` passa a chamar a edge function `sonax-click-to-call` com
  `{ numero, deal_id }` (o mesmo caminho do botão "Ligar"), via um novo helper
  `dialViaSonax()` (reuso da lógica de `useSonaxClickToCall`, mas sem toast por chamada).
- Remover do contexto: `useTwilio()`, `callStatus`, `currentCallId`, `hangUp`, `deviceStatus`,
  `initializeDevice`, o `useEffect` de transição de status, a checagem de voicemail em `calls`
  e o `ringTimeoutMs` (não há ring detectável).
- Novo ciclo de vida por lead, dirigido pelo SDR (não por evento):
  1. Dispara Sonax → estado `awaiting-outcome`, lead marcado `in-progress`.
  2. Se a Sonax retornar erro (`sonax_erro`, ramal não atendendo) → resultado `failed`
     automático, respeitando `maxAttemptsPerLead`/`retryDelayMs` como hoje.
  3. Se retornar sucesso → o app abre o card de outcome (item 2) e **espera** o SDR.
     `betweenCallsMs` deixa de ser timer cego; ele só conta depois do outcome registrado
     (modo "avançar automático" opcional, com botão "Próximo" sempre disponível).
- `pause`/`stop`/`skipCurrent` deixam de chamar `hangUp` (o app não controla mais a chamada);
  passam apenas a parar o loop. `skipCurrent` registra `skipped` sem outcome.
- Manter o carimbo `crm_deals.last_auto_dialer_call_at` como está.

### Mudança de experiência (precisa aparecer na UI)
A ligação agora toca no **ramal/softphone do SDR**, não no navegador. Ajustes:

- `AutoDialerPanel.tsx`: banner fixo no topo do painel — "A ligação toca no seu softphone/ramal
  {ramal}. Mantenha o softphone aberto e atenda por lá." + badge com o ramal lido de
  `sdr_ramal_mapping` (bloqueia o `start()` com mensagem clara se não houver ramal ativo).
- `AutoDialerInCallBanner.tsx`: sai o bloco Twilio (mute/hangup/`callDuration`) e entra o card de
  outcome (item 2) com nome/telefone do lead, botão "Ver dados" (drawer atual) e "Pular".
- `TwilioSoftphone.tsx` / `InlineCallControls.tsx` / `QuickDialer*`: deixam de ser montados no
  fluxo de discagem (ver Rollout).

## 2. Captura de outcome manual

Já existe `src/components/crm/PostCallModal.tsx` com exatamente essa pergunta ("Como foi a
ligação?") e 10 opções (`sem_contato`, `ocupado`, `caixa_postal`, `numero_errado`, `interessado`,
`nao_interessado`, `agendou_r1`, `agendou_r2`, `follow_up`, `outro`). Reaproveitar, com dois ajustes:

- Generalizar: hoje ele grava por `callId` na tabela `calls`. Passa a receber
  `{ dealId, activityId }` e a gravar em `deal_activities` (item 3). `callId` sai.
- Adicionar a opção explícita **"Atendida / falei com o lead"** e marcar cada opção com um flag
  derivado `answered: boolean` (`interessado`, `nao_interessado`, `agendou_r1`, `agendou_r2`,
  `follow_up`, `atendida` = true; `sem_contato`, `ocupado`, `caixa_postal`, `numero_errado` = false).
- No Auto-Discador, versão compacta inline (botões grandes no banner) em vez de modal, para não
  travar a fila; o modal completo (com observações) fica no botão avulso "Ligar".
- Sem outcome, a fila não avança sozinha: aviso "registre o resultado para continuar", com escape
  "Não sei / pular registro" que grava `outcome='nao_registrado'` (conta como discagem, não como
  atendida).

## 3. Onde fica registrado

Fonte única: `deal_activities` com `activity_type='click_to_call'`.

- A edge function `sonax-click-to-call` já insere a linha no disparo. Adicionar no `metadata`:
  `origin: 'auto_dialer' | 'manual'` (novo campo no body), `attempt`, e retornar o `id` da
  atividade criada para o front poder atualizá-la.
- O outcome é gravado por `UPDATE` nessa mesma linha (não cria linha nova):
  `metadata.outcome`, `metadata.answered`, `metadata.notes`, `metadata.outcome_at`.
  Precisa de policy de UPDATE em `deal_activities` restrita ao autor da atividade (checar RLS
  atual; se não permitir, fazer o update por uma edge function `sonax-call-outcome`).
- Aposentar o `activity_type='call_result'` que o auto-discador Twilio gravava.
- Nada da tabela `calls` é apagado — histórico Twilio permanece consultável, só deixa de ser escrito.

## 4. Painel "Atividades por SDR"

`src/hooks/useSdrActivityMetrics.ts` passa a ler **só** `deal_activities`
(`activity_type='click_to_call'`), somando auto-discador + avulso:

- `discagens` = total de linhas; `discagensErro` = `metadata.ok === false`; `taxaErro`.
- `atendidas` = `metadata.answered === true`; `conexao%` = atendidas / discagens.
- `qualificadas` = outcome em (`interessado`, `agendou_r1`, `agendou_r2`, `follow_up`);
  `qualif%` = qualificadas / discagens.
- `semRegistro` = discagens com sucesso e sem outcome — coluna própria, para cobrar disciplina.
- `caixaPostal` / `numeroErrado` vindos do outcome (agora reais, não heurística de duração).
- `leadsDiscados` (deal_id distintos), `ligPorLead`, `ramais` (de `metadata.ramal`).
- Removidos: `classifyCall`, thresholds de duração (`useCallClassificationThresholds`,
  página `admin/CallThresholdsConfig`), `ringDropCalls`, `duration_seconds`.

`SdrActivityMetricsTable.tsx` — colunas: SDR | Ramal | Discagens | Falhas | Taxa erro | Atendidas |
Conexão % | Qualificadas | Qualif % | S/ registro | Lig/Lead | Leads | Notas | Movimentos |
WhatsApp | Detalhes. Ordenação por discagens desc, linha de totais mantida.
`SdrLeadCallsDialog` passa a listar as tentativas de `deal_activities` (hora, ramal, ok, outcome,
`sonax_body` truncado) em vez de linhas de `calls`.

Aviso de histórico: `click_to_call` só existe a partir de 10/08 — períodos anteriores ficam vazios
no painel de ligações. Sugestão: um seletor "Fonte: Sonax (atual) / Twilio (histórico)" só nessa
tabela, para não perder a leitura do passado.

## 5. Rollout — recomendação

Recomendo **não** trocar tudo de uma vez. O risco não é técnico, é operacional: o SDR deixa de
ouvir a ligação no navegador e passa a depender do softphone registrado — e já vimos ramal
"NAO ESTA ATENDENDO" na Sonax, exatamente o sintoma de softphone desregistrado.

Plano em 3 fases:

1. **Fase 1 (flag, ~1 dia):** flag por usuário — nova coluna `sdr_ramal_mapping.auto_dialer_engine`
   (`'twilio' | 'sonax'`, default `twilio`), lida no `AutoDialerContext`. Motor Sonax só para
   Mayara (ramal 107) + 1 SDR. O código Twilio fica intacto atrás da flag.
2. **Fase 2 (validação, 2-3 dias):** conferir no painel que discagens/atendidas/outcome batem com
   o que os 2 SDRs relatam, e que o softphone se mantém registrado o dia todo.
3. **Fase 3 (corte):** default para `sonax`, e então remover `TwilioContext`, `TwilioSoftphone`,
   `useCallQualificationTrigger` na parte de Twilio, secrets e edge functions Twilio de discagem.
   A tabela `calls` fica só como histórico.

Se o usuário preferir corte seco, é viável — mas então o combinado é fazer numa manhã, com os SDRs
avisados de que precisam abrir o softphone antes de iniciar a fila.