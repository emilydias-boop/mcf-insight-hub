# Bug: lead volta de "Sem Interesse" para "Em contato" após chamada

## Causa raiz (confirmada no banco)

Lead `Danilo da Costa Pereira - A010` (id `b3a5af02…`) hoje 18/06 17:19:
- O usuário arrastou o card para **Sem Interesse** (`b06c9413…`) durante a ligação Twilio.
- Quando o webhook `twilio-voice-webhook` recebeu o status final da chamada (`no-answer`), ele chamou a RPC `public.auto_move_deal_to_em_contato`, que **moveu o deal de "Sem Interesse" → "Em contato"** automaticamente, gravando a activity:

  > "Movido automaticamente para 'Em contato' — tentativa de chamada Twilio (não atendida)"

A função tem uma whitelist de estágios "de origem" permitidos para esse auto-move:

```
e6fab26d  ANAMNESE INCOMPLETA
d346320a  Lead Gratuito
3c81d73b  Lead Instagram
cf4a369c  Novo Lead
a1d19874  Lead Qualificado
b06c9413  Sem Interesse   ← ERRADO
```

"Sem Interesse" é estágio terminal/negativo e **não deve** ser elegível para o auto-move pós-tentativa de chamada. Sua presença na lista faz o sistema sobrescrever a decisão consciente do usuário toda vez que ele move um lead para "Sem Interesse" enquanto a ligação ainda está finalizando no Twilio.

Isso explica perfeitamente o sintoma descrito:
- UI mostra o card sendo movido para "Sem Interesse" (update local + update no Supabase ok).
- Segundos depois o webhook Twilio dispara e a RPC sobrescreve o `stage_id` para `b1c0a7e2` (Em contato).
- No próximo refetch o card aparece de volta em "Em contato".

## Correção

Migration única recriando `public.auto_move_deal_to_em_contato` com o mesmo corpo, removendo apenas `b06c9413-0312-4f1d-89b4-822d79bc6a90` (Sem Interesse) do array `v_allowed`. Nenhuma outra mudança de assinatura/lógica.

Lista final de estágios elegíveis ao auto-move:

```
ANAMNESE INCOMPLETA, Lead Gratuito, Lead Instagram, Novo Lead, Lead Qualificado
```

## Validação

1. Após a migration, abrir o deal de Danilo, mover manualmente para "Sem Interesse" novamente.
2. Disparar (ou aguardar) uma nova tentativa de chamada.
3. Conferir em `deal_activities` que **não** aparece novo registro `stage_change` automático para "Em contato" e que `crm_deals.stage_id` permanece em `b06c9413` (Sem Interesse).

## Fora de escopo

- Não tocar no front (kanban, InlineCallControls, etc.). O bug é 100% server-side na RPC.
- Não alterar o webhook `twilio-voice-webhook` — ele continua chamando a RPC, que passa a respeitar "Sem Interesse".
