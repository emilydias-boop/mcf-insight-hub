## Objetivo

Transcrever automaticamente todas as ligações Twilio com duração superior a 60s (faixas "efetiva" + "qualificada"), gerar um resumo inteligente em PT-BR e gravar:
1. No card do Negócio (campo Notas) — na stage atual e visível em todas as etapas seguintes
2. No agendamento da Agenda R1 vinculado àquele lead (campo de notas do attendee)

## Como vai funcionar

```text
[Twilio Voice]
    │
    │  recordingStatusCallback (recording_completed)
    ▼
[Edge Function: twilio-voice-intelligence-webhook]
    │
    │  1. Valida assinatura Twilio
    │  2. Lê duration da chamada (calls.duration_seconds)
    │  3. Se < 60s → ignora (log only)
    │  4. Se ≥ 60s → cria Transcript no Voice Intelligence Service
    ▼
[Twilio Voice Intelligence]
    │
    │  transcript.completed callback
    ▼
[Edge Function: twilio-transcript-callback]
    │
    │  1. Busca sentences + operator results
    │  2. Chama Lovable AI (google/gemini-3-flash-preview)
    │     - System prompt: SDR coach PT-BR
    │     - Output structured: 3-5 bullets + respostas script de descoberta
    │  3. UPDATE calls SET notes, transcript_url, ai_summary, ...
    │  4. UPDATE crm_deals.custom_fields.callSummary (acumula histórico)
    │  5. UPDATE meeting_slot_attendees.notes (R1 atual + futuros)
    │  6. INSERT deal_activities (timeline)
```

## Mudanças no banco

**Tabela `calls`** — novos campos:
- `transcript_sid` (text) — SID do Voice Intelligence Transcript
- `transcript_status` (text) — `pending` | `processing` | `completed` | `failed` | `skipped_short`
- `ai_summary` (jsonb) — `{ bullets: string[], discovery: {...}, raw_transcript_url }`
- `ai_processed_at` (timestamptz)

**Tabela `crm_deals.custom_fields`** (jsonb existente) — nova chave:
- `callSummaries: [{ call_id, processed_at, bullets, discovery }]` — histórico acumulado, sempre visível em todas as stages

**Tabela `meeting_slot_attendees.notes`** (já existe) — atualizada via trigger / função

Nenhuma tabela nova. Nenhum dado destrutivo.

## Edge Functions

### `twilio-voice-intelligence-webhook` (novo)
- Recebe `recording_completed` da Twilio
- Cria Transcript via `POST /v2/Transcripts` com `ServiceSid` + `MediaUrl` + `LanguageCode=pt-BR`
- Marca `calls.transcript_status = 'processing'`

### `twilio-transcript-callback` (novo)
- Recebe webhook `transcript.completed` do Voice Intelligence
- Busca sentences via Twilio API
- Chama Lovable AI Gateway com schema estruturado:
  ```
  {
    bullets: string[] (3-5),
    discovery: {
      tempo_conhece_mcf, profissao, renda,
      ja_constroi, possui_imovel, possui_terreno, tem_socio
    }
  }
  ```
- Persiste em `calls`, `crm_deals`, `meeting_slot_attendees`, `deal_activities`

## Frontend

**`InlineCallControls.tsx`** — adiciona badge "Resumo IA" quando `ai_summary` existir, abre dialog com bullets + respostas discovery.

**`SdrLeadCallsDialog.tsx`** — coluna nova "Resumo IA" mostrando ícone de status (pendente / pronto / pulada por curta).

**Card do Negócio (CRM)** — seção "Resumos de Ligações IA" lista o histórico `callSummaries` em ordem cronológica reversa, visível em qualquer stage.

**Agenda R1 (`AttendeeNotes`)** — note_type novo `'call_summary'` para diferenciar das anotações manuais; renderizado com badge "🤖 Resumo de Ligação".

## Configuração Twilio (manual pelo usuário)

Necessário antes de ativar:
1. Ativar **Voice Intelligence** no console Twilio (https://console.twilio.com/us1/develop/voice-intelligence)
2. Criar um **Service** com idioma PT-BR
3. Copiar o `VOICE_INTELLIGENCE_SERVICE_SID` → guardar em secret
4. Configurar `recordingStatusCallback` no TwiML App apontando para a nova edge function

Eu vou pedir o `TWILIO_VOICE_INTELLIGENCE_SERVICE_SID` como secret depois que você aprovar este plano. Os outros secrets Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`) já existem.

## QA Doc

Conforme preferência do Thobson, vou criar `docs/qa/2026-06-17-twilio-transcricao-resumo-ia.md` com roteiro de testes funcionais + regressão.

## Pontos de atenção

- **Custo**: Voice Intelligence cobra por minuto transcrito (~$0.05/min). O filtro >60s + apenas chamadas atendidas reduz spend.
- **LGPD**: as gravações já são feitas hoje; o transcript fica armazenado na Twilio + apenas o resumo no nosso banco. Transcript completo só via link.
- **Idempotência**: usar `transcript_sid` como chave única para evitar reprocessamento duplicado.
- **Vinculação à Agenda R1**: usa `meeting_slot_attendees` onde `deal_id = calls.deal_id` AND `status IN ('confirmed','pre_scheduled','rescheduled')`. Notas se mantêm no attendee mesmo após mudança de stage do deal.
