# Quedas de ligação dos SDRs — causa raiz e correção

## Diagnóstico

Não é timeout de edge function nem do token Twilio (refresh está OK). A causa real está no **Answering Machine Detection (AMD)** configurado no TwiML.

Evidência nos logs reais (`twilio-voice-webhook`):

```
✅ Voicemail detected, hung up call CA2a26... (AnsweredBy=unknown)
✅ Voicemail detected, hung up call CA49e2... (AnsweredBy=machine_end_beep)
```

Dois problemas combinados em `supabase/functions/twilio-voice-twiml/index.ts` + `twilio-voice-webhook/index.ts`:

1. **`unknown` é tratado como máquina** → quando o AMD do Twilio não consegue decidir (humano fala curto, ambiente barulhento, "alô?" rápido), o webhook derruba a chamada do lead atendido.
2. **`machineDetection="DetectMessageEnd"`** → esse modo espera o BIPE da caixa postal antes de decidir. Para isso ele mantém o áudio aberto por até ~30s "ouvindo". Se o humano fala e dá uma pausa de silêncio, o AMD classifica como `machine_end_silence` ou `machine_end_beep` e o webhook desliga **com o SDR já em conversa**.

Ambos os comportamentos batem com o relato de "ligação caiu durante a conversa".

## Correção

### 1. Mudar o modo de AMD para o mais seguro (`twilio-voice-twiml/index.ts`)

Trocar:
```
machineDetection="DetectMessageEnd"
```
por:
```
machineDetection="Enable"
machineDetectionTimeout="5"
machineDetectionSpeechThreshold="2400"
machineDetectionSpeechEndThreshold="1200"
machineDetectionSilenceTimeout="5000"
```

- `Enable` decide humano/máquina **antes** de a chamada conectar ao SDR (não fica "ouvindo" durante a conversa).
- `machineDetectionTimeout=5` limita a 5s a janela de detecção; se passar disso, Twilio devolve `unknown` e a chamada segue normal.
- Os demais parâmetros tornam a detecção mais conservadora (menos falso-positivo de "máquina" em humanos).

### 2. Não derrubar mais quando `AnsweredBy=unknown` (`twilio-voice-webhook/index.ts`)

Trocar a condição:
```ts
const isMachine = answeredBy.startsWith('machine') || answeredBy === 'fax' || answeredBy === 'unknown';
```
por:
```ts
const isMachine = answeredBy.startsWith('machine') || answeredBy === 'fax';
// 'unknown' = AMD não decidiu → tratar como humano, NÃO desligar
```

Quando vier `unknown`, apenas registrar `outcome` informativo (ex.: `amd_unknown`) sem chamar a API REST de hangup.

### 3. (Opcional, recomendado) Logar `AnsweredBy` no card de qualificação

Já temos a coluna no `calls`. Apenas exibir um pequeno selo "Possível caixa postal" quando `AnsweredBy` começar com `machine_*` ajudaria o SDR a entender o motivo de uma queda futura, sem afetar a chamada.

## Por que isso resolve

- O SDR só será desconectado automaticamente quando o Twilio tiver **certeza** (`machine_start`, `machine_end_beep`, `machine_end_silence`, `machine_end_other`, `fax`) e essa decisão acontece nos primeiros ~5s, antes da fala humana.
- Casos ambíguos (`unknown`) deixam de derrubar a conversa.
- Mantemos o benefício original do AMD: cair em caixa postal continua sendo desligado automaticamente.

## Arquivos alterados

- `supabase/functions/twilio-voice-twiml/index.ts` — parâmetros do `<Number machineDetection=...>`
- `supabase/functions/twilio-voice-webhook/index.ts` — condição `isMachine` e branch do hangup
- (opcional) `src/components/crm/InlineCallControls.tsx` ou modal de qualificação — selo "Possível caixa postal"

Sem mudanças de schema, sem migration, sem mexer no fluxo do auto-dialer no front. As edge functions são re-deployadas automaticamente.

## Validação após deploy

1. Abrir a `Discadora` e ligar para 5–10 leads.
2. Conferir nos logs do `twilio-voice-webhook` que chamadas com `AnsweredBy=unknown` **não** geram mais a linha `✅ Voicemail detected, hung up call ...`.
3. Confirmar com os SDRs que pararam as quedas no meio da conversa.
4. Caixa postal real deve continuar desligando sozinha (`machine_end_*`).
