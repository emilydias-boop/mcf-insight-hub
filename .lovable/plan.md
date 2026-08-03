# Mapa da ligação de voz atual (Twilio) — o que precisaria ser reconstruído para Zenvia

Apenas investigação. Nada foi editado.

## 1. Arquitetura em uma frase

Hoje NÃO existe uma edge function "iniciar ligação". A ligação é feita **no browser**, via WebRTC com o **Twilio Voice SDK** (`@twilio/voice-sdk`): o front cria um `Device` com um access token, chama `device.connect()`, e a Twilio busca o TwiML no servidor para discar o número real. Todo o resto (status, gravação, AMD, transcrição) chega por webhooks da Twilio.

```text
DealKanbanCard / QuickActionsBlock / QuickDialer / AutoDialer
        │ makeCall(phone, dealId, contactId, originId)
        ▼
TwilioContext  ──invoke──> edge: twilio-token   (JWT Voice grant, TwiML App SID)
        │ INSERT em `calls` (status=initiated, started_at, to_number, direction=outbound)
        │ device.connect({ To, callRecordId })
        ▼
Twilio Cloud ──POST──> edge: twilio-voice-twiml  → <Dial> com record + AMD + callbacks
        │
        ├─ action / recordingStatusCallback ──> edge: twilio-voice-webhook  (status, duração, recording_url)
        ├─ amdStatusCallback (?type=amd) ─────> mesma função (answered_by, outcome=voicemail, hangup via REST)
        └─ Voice Intelligence transcript.completed ──> edge: twilio-transcript-callback (IA → ai_summary)
```

## 2. Edge functions envolvidas em voz

| Função | Papel | Substituição Zenvia |
|---|---|---|
| `twilio-token` | Gera JWT do Voice SDK (identity = user id autenticado, grant outgoing com TwiML App SID). | Equivalente ao token/credencial do WebPhone Zenvia (ou desaparece se a Zenvia for click-to-call server-side). |
| `twilio-voice-twiml` | Recebe o `connect()` do browser e devolve TwiML `<Dial>` com `callerId` (TWILIO_PHONE_NUMBER), `timeout=30`, `record="record-from-answer-dual"`, AMD (`machineDetection=Enable`, thresholds) e URLs de callback. Valida assinatura `X-Twilio-Signature`. Normaliza número para E.164 (+55 default). | Zenvia não usa TwiML: viraria uma chamada REST de originação (ou fluxo/flow da Zenvia). Este arquivo é o mais "Twilio-only" de todos. |
| `twilio-voice-webhook` | 3 responsabilidades em um endpoint: (a) callback AMD → grava `answered_by`, `outcome='voicemail'/'amd_unknown'`, derruba a chamada via REST se for máquina; (b) callback de gravação → `recording_url` (.mp3) + `duration_seconds` e dispara transcrição Voice Intelligence quando duração ≥ 60s; (c) callback de status → mapeia status Twilio→interno, `answered_at`, `ended_at`, `duration_seconds`, e chama a RPC `auto_move_deal_to_em_contato` em qualquer status terminal (completed/no-answer/busy/failed/canceled). | Precisa ser reescrito para o payload de webhook da Zenvia, incluindo novo mapa de status e nova fonte de gravação. |
| `twilio-transcript-callback` | Recebe `transcript.completed`, busca as frases em `intelligence.twilio.com`, monta prompt (system prompt MCF + tool schema de discovery), chama Lovable AI, e persiste em `calls.ai_summary/summary/transcript_status/ai_processed_at`, `crm_deals.custom_fields.callSummaries`, `attendee_notes` (note_type `call_summary`) e `deal_activities` (`ai_call_summary`). | A camada de IA/persistência é reaproveitável quase 100%; só muda a origem da transcrição (Zenvia não tem Voice Intelligence — provavelmente STT próprio ou transcrição a partir do áudio da gravação). |
| `get-recording` | Proxy autenticado que baixa o .mp3 da Twilio com Basic Auth e devolve ao player (usado por `CallHistorySection`, que extrai o RecordingSid da URL). | Precisa novo proxy para a URL/auth de gravação da Zenvia. |
| `twilio-status-webhook` | Status de entrega de mensagem (WhatsApp/SMS), **não** de voz. | Fora de escopo. |

Todas configuradas com `verify_jwt = false` em `supabase/config.toml` (webhooks públicos protegidos por validação HMAC-SHA1 da assinatura Twilio).

## 3. Frontend — onde fica o botão de ligar

Núcleo: **`src/contexts/TwilioContext.tsx`** (687 linhas) — único ponto que fala com a Twilio:
- `initializeDevice()`: carrega o SDK dinamicamente, pega token via `twilio-token`, cria `Device` com `edge: 'sao-paulo'`, codecs opus/pcmu, auto-refresh em `tokenWillExpire` (TTL 1h, refresh forçado após 50 min), auto-init em background no login para quem tem role `sdr`, destrói o device no logout.
- `makeCall(phone, dealId?, contactId?, originId?)`: preflight de microfone (`getUserMedia`), INSERT na tabela `calls`, `device.connect({ To, callRecordId })`, retry com token novo (trata erro 31402 de microfone), tracking de duração local, `hangUp()`, `toggleMute()`.
- Também controla o modal global de qualificação e o pipeline de teste (`crm_origins.name = 'Twilio – Teste'`).

Consumidores de `makeCall` (todos os "botões de ligar"):
- `src/components/crm/DealKanbanCard.tsx` (botão no card do Kanban — o principal)
- `src/components/crm/QuickActionsBlock.tsx` (drawer do deal)
- `src/components/crm/QuickDialer.tsx` + `QuickDialerLauncher.tsx` (discador manual flutuante)
- `src/components/crm/TaskDetailPanel.tsx` (tarefa tipo `call`)
- `src/components/sdr/PendingActionsPanel.tsx`
- `src/contexts/AutoDialerContext.tsx` (auto-discador)

UI de estado: `src/components/crm/TwilioSoftphone.tsx` (é ali, linhas ~366-369, que aparece "Pronto para ligar" / "Use o botão de ligar nos cards de deals"), `InlineCallControls.tsx`, `AutoDialerInCallBanner.tsx`, montados globalmente em `src/components/layout/MainLayout.tsx`. Histórico e player: `src/components/crm/CallHistorySection.tsx`.

## 4. Secrets usadas (só nomes)

Voz: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_TWIML_APP_SID`, `TWILIO_PHONE_NUMBER`, `TWILIO_VOICE_INTELLIGENCE_SERVICE_SID`. IA: `LOVABLE_API_KEY`.

Não-voz (WhatsApp/conteúdo, ficariam como estão): `TWILIO_WHATSAPP_FROM`, `TWILIO_WA_TEMPLATE_SID`.

## 5. Auto-discador — sim, depende da mesma infra

`src/contexts/AutoDialerContext.tsx` (424 linhas) + `AutoDialerPanel.tsx`, `AutoDialerDealDrawer.tsx`, `AutoDialerInCallBanner.tsx`, `DialerLauncherContext.tsx`. Ele apenas orquestra a fila (estados `running` / `paused-in-call` / `paused-qualifying`, skip, log em `deal_activities`) e chama `makeCall` do TwilioContext — ou seja, se `makeCall` mantiver a mesma assinatura, o auto-discador **não precisa ser reescrito**. Ele depende também de `callStatus`/`callDuration`/`currentCallDealId` e de `hangUp`/`toggleMute` do mesmo contexto, e do beep de atendimento disparado quando o estado vira `paused-in-call`.

## 6. Checklist "o que teria que ser reconstruído para Zenvia"

Reconstruir de fato:
1. Autenticação/token da Zenvia (substituindo `twilio-token`).
2. Originação da chamada: definir se é WebRTC (WebPhone Zenvia no browser) ou click-to-call server-side (a Zenvia liga para o SDR e depois para o lead). Isso decide se `twilio-voice-twiml` some ou vira um endpoint de originação REST.
3. Webhook de status: novo parser + novo mapa de status (mantendo os valores internos `initiated/ringing/in-progress/completed/failed/busy/no-answer/canceled`).
4. Gravação: novo callback + novo proxy autenticado no lugar de `get-recording` (o front hoje extrai o `RecordingSid` da URL da Twilio — esse parsing precisa mudar).
5. Detecção de caixa postal (AMD): verificar se a Zenvia oferece equivalente; hoje ela grava `answered_by` e derruba a chamada automaticamente.
6. Transcrição: fonte nova (Voice Intelligence não existe na Zenvia) alimentando `transcript_sid`/`transcript_status`.
7. Validação de assinatura dos webhooks no padrão da Zenvia (hoje HMAC-SHA1 Twilio).

Reaproveitável quase integralmente:
- Esquema da tabela `calls` e todos os consumidores de métricas/relatórios.
- Camada de IA e persistência do resumo (prompt, `ai_summary`, `crm_deals.custom_fields.callSummaries`, `attendee_notes`, `deal_activities`).
- RPC `auto_move_deal_to_em_contato`.
- Toda a UI (botões, softphone, auto-discador, histórico) **se** o novo provider for encapsulado atrás de um contexto com a mesma API `makeCall/hangUp/toggleMute/callStatus/deviceStatus`.

Recomendação de arquitetura: extrair uma interface `VoiceProvider` e um flag de provider (Twilio | Zenvia) por usuário/BU, para testar Zenvia em paralelo sem derrubar o Twilio em produção.

## 7. Pontos que preciso confirmar antes de desenhar o plano de integração

1. A Zenvia Voz será usada como **WebPhone no browser** (SDR fala pelo navegador, como hoje) ou **click-to-call** (a Zenvia liga primeiro para o ramal/celular do SDR)? Isso muda tudo.
2. Vamos manter Twilio ativo em paralelo (feature flag por usuário/BU) ou é troca total?
3. Transcrição + resumo IA precisa continuar no piloto, ou o teste inicial é só "discar, gravar, registrar status"?
