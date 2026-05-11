## Objetivo
Mover o lead para a stage **"Em contato"** em **toda tentativa de ligação finalizada**, atendida ou não — porque a tentativa em si já caracteriza contato.

## Mudança (1 arquivo)
`supabase/functions/twilio-voice-webhook/index.ts`

Hoje o auto-move só dispara quando `CallStatus === 'completed'`. Vou ampliar para incluir todos os status terminais que o Twilio envia para uma chamada que efetivamente saiu:

- `completed` (já existe)
- `no-answer`
- `busy`
- `failed`
- `canceled`

A função SQL `auto_move_deal_to_em_contato` continua igual — ela já é idempotente (só move se a stage atual for Novo Lead / Lead Qualificado / Lead Gratuito / Lead Instagram / ANAMNESE INCOMPLETA / Sem Interesse). Se o lead já está em "Em contato" ou em qualquer stage adiante (R1 Agendada etc.), nada acontece.

### Descrição registrada em `deal_activities`
Vou ajustar a `p_description` para refletir o resultado real, ex.:
- `Movido automaticamente para "Em contato" — chamada Twilio (atendida, 47s)`
- `Movido automaticamente para "Em contato" — tentativa de chamada Twilio (não atendida)`
- `Movido automaticamente para "Em contato" — tentativa de chamada Twilio (ocupado)`

E `p_metadata` ganha `call_status` (completed/no-answer/busy/failed/canceled) além dos campos atuais (`call_sid`, `call_id`, `duration_seconds`, `answered_by`).

## O que **não** muda
- Nenhuma alteração em SQL / função RPC / migração.
- Nenhum impacto em métricas de chamada, gravação, AMD, ou em qualquer outra automação.
- Stages whitelisted continuam as mesmas (lead já qualificado / em reunião não regride).
- Chamadas que nem foram tentadas (status `queued`/`initiated` apenas) continuam não movendo — só os 5 status terminais acima.

## Bug paralelo observado nos logs
```
[Em contato] RPC erro: invalid input syntax for type uuid:
"nicola.ricci@minhacasafinanciada.com"
```
Isso é independente desta mudança (parece que em algum caminho o `deal_id` da `calls` ficou com um e-mail). Posso abrir um plano separado se quiser investigar.