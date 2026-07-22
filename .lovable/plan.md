## Objetivo

Disparar o webhook `consorcio-carta-cadastrada-webhook` (e a automação de boas-vindas por e-mail) no momento em que a proposta chega em **Concluídas - Operacional** (status `aceita`), sem depender do passo operacional "Abrir cota" / `consortium_card_id`.

Hoje o gatilho só roda quando existe `consortium_card_id`, então cartas como a do Mário Lucas ficam visíveis na aba mas nunca disparam a comunicação — exatamente o comportamento que você quer corrigir.

## Mudanças

1. **Novo gatilho no fluxo de "aceitar proposta"** (`src/pages/crm/PosReuniao.tsx` / hook correspondente que muda `status → aceita`):
   - Após persistir o status `aceita`, chamar o `consorcio-carta-cadastrada-webhook` usando os dados da própria `consorcio_proposals` + `crm_deals` (nome, email, telefone, closer, produto, valor).
   - Passar `consortium_card_id = null` quando ainda não existir — o edge function já foi usado dessa forma no reenvio manual do Pedro.

2. **Idempotência**: adicionar coluna `webhook_carta_enviado_em timestamptz` em `consorcio_proposals`. O disparo só ocorre se estiver `null`; após sucesso, é preenchida. Isso evita duplicidade se a proposta for reaceita ou se depois a carta for aberta em Controle Consórcio.

3. **Automação de boas-vindas (e-mail)**: acionar o `automation-event-dispatcher` com o evento `consorcio.carta.cadastrada` no mesmo ponto, respeitando o `boas_vindas_email_enviado_em` já existente em `consorcio_pending_registrations` (ou criar coluna equivalente em `consorcio_proposals` se o registro pendente ainda não existir).

4. **Fluxo "Abrir cota" continua funcionando**: quando a cota for finalmente aberta e o `consortium_card_id` for gerado, o webhook **não** dispara de novo (já marcado como enviado). Apenas atualiza o card no Make, se necessário, via um segundo evento opcional `consorcio.carta.aberta` — fora do escopo aqui, só menciono para deixar claro que não haverá duplicidade.

5. **Backfill do Mário Lucas**: após deploy, disparar manualmente o webhook para a proposta dele (mesmo esquema do Pedro) e marcar `webhook_carta_enviado_em`.

## Detalhes técnicos

- Migração: `ALTER TABLE public.consorcio_proposals ADD COLUMN webhook_carta_enviado_em timestamptz;`
- Ponto de disparo: hook que faz `update consorcio_proposals set status='aceita'` (provavelmente `useAceitarProposta` / equivalente em `PosReuniao.tsx`). Chamar via `supabase.functions.invoke('consorcio-carta-cadastrada-webhook', { body: { proposal_id } })`.
- Edge function `consorcio-carta-cadastrada-webhook`: ajustar para aceitar `proposal_id` sozinho (carregar dados da proposta + deal) quando `consortium_card_id` não vier. Idempotência via `webhook_carta_enviado_em`.
- Sem mudanças na UI da aba "Concluídas - Operacional".
