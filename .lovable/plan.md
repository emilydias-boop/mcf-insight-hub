## Diagnóstico

Os logs mais recentes mostram várias chamadas com `Status=failed` logo após o TwiML ser gerado (ex: `CA0b67a709...`, `CA07ad1e31...`, `CA44fcbcea...`). Isso bate com o sintoma: "não está chamando e nem contando tempo".

A causa é a última alteração no `twilio-voice-twiml/index.ts`: movi os atributos de **Answering Machine Detection** (`machineDetection`, `machineDetectionTimeout`, `machineDetectionSpeechThreshold`, `machineDetectionSpeechEndThreshold`, `machineDetectionSilenceTimeout`, `amdStatusCallback`, `amdStatusCallbackMethod`) para dentro do noun `<Number>`.

Esses atributos **não existem no `<Number>`** — eles pertencem ao verbo `<Dial>`. Quando o Twilio recebe TwiML com atributos desconhecidos no `<Number>`, ele rejeita o dial → a chamada termina como `failed` antes mesmo de tocar, o tempo nunca começa a contar e o SDR vê "tudo travado".

## Correção

Voltar os atributos de AMD para o `<Dial>` (que é onde a documentação oficial os coloca), **mantendo** os limites conservadores que escolhemos para evitar derrubar conversas humanas:

```xml
<Dial 
  callerId="..."
  timeout="30"
  record="record-from-answer-dual"
  recordingStatusCallback="..."
  recordingStatusCallbackEvent="completed"
  action="..."
  machineDetection="Enable"
  machineDetectionTimeout="5"
  machineDetectionSpeechThreshold="2400"
  machineDetectionSpeechEndThreshold="1200"
  machineDetectionSilenceTimeout="5000"
  amdStatusCallback="..."
  amdStatusCallbackMethod="POST">
  <Number>+55...</Number>
</Dial>
```

Comportamento esperado:
- `machineDetection="Enable"` decide humano/máquina **antes** de conectar o SDR (não fica "escutando" durante a conversa como o `DetectMessageEnd` antigo).
- Sem atributos inválidos no `<Number>`, o Twilio aceita o TwiML e a chamada toca normalmente.
- O webhook continua tratando `unknown` como não-hangup (correção anterior preservada).

## Validação

1. Após o deploy, fazer 1 chamada de teste — confirmar que o status na UI sai de "Conectando" para "Chamando" e o cronômetro começa.
2. Conferir nos logs do `twilio-voice-webhook` se o `Status=ringing`/`in-progress`/`completed` aparece em vez de `failed` imediato.
3. Validar que conversas humanas não caem mais no meio (objetivo original do ajuste de AMD).
