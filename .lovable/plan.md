## Diagnóstico (verificado no código)

O webhook `https://hook.us1.make.com/pk492b4dfi83s1u4k566i98mg34k8xto` é chamado pela edge function `consorcio-carta-cadastrada-webhook`, que hoje é disparada em **4 pontos diferentes** (`src/hooks/useConsorcioPendingRegistrations.ts`):

1. `useCreatePendingRegistration` — quando o Closer conclui "Inserir Dados" em **Cartas Negociadas** (linha ~481);
2. `useMarkPendingAsCadastrada` — ao mover para "Cadastradas" (linha ~545);
3. `useLinkPendingToCard` — ao vincular a uma cota existente (linha ~692);
4. `useOpenCota` — no passo "Abrir cota" (linha ~1074).

Mais o botão manual "Reenviar webhook" em `src/pages/crm/PosReuniao.tsx` (~linha 821).

**Por que chega vazio:** o payload da edge function monta o bloco `carta` a partir da tabela `consortium_cards`. No disparo nº 1 (o único que acontece em Cartas Negociadas) ainda **não existe card** — `card_id` vai `null` e todo o bloco `carta` sai vazio (grupo, cota, produto, vencimento, data de contratação etc.). Além disso, esse disparo grava a flag `webhook_carta_cadastrada_enviado_em`, que torna os disparos seguintes (nº 2/3/4, que teriam os dados completos) **silenciosamente ignorados**. Os envios "com todos os dados" são os casos em que a flag não existia (registros antigos) ou o reenvio manual foi usado.

## O que será feito

**Gatilho único:** manter apenas o disparo no momento em que o Closer conclui o cadastro dos dados da cota em **Cartas Negociadas** (`useCreatePendingRegistration`). Remover os disparos automáticos de "Cadastradas", "Vincular cota" e "Abrir cota". O botão manual "Reenviar webhook" continua existindo (com `force`).

**Payload sempre completo:** alterar a edge function para montar o bloco `carta` a partir do **cadastro pendente** (`consorcio_pending_registrations`, que já contém valor de crédito, prazo, produto, condição de pagamento, vencimento, vendedor, origem, parcelas pagas pela empresa, observações etc.), usando a proposta como fallback (`valor_credito`, `prazo_meses`, `tipo_produto`, `origem_lead`) e o `consortium_cards` apenas como enriquecimento opcional (grupo/cota, quando já existir). Assim o Make recebe o mesmo formato de campos em todos os envios, com `null` só onde o dado realmente não foi informado.

**Guarda contra envio incompleto:** se o cadastro pendente não tiver os campos mínimos (titular, contato e valor de crédito), a função responde `skipped` sem chamar o Make, e a flag de envio não é gravada — permitindo reenvio depois.

## Detalhes técnicos

- `supabase/functions/consorcio-carta-cadastrada-webhook/index.ts`: reescrever a montagem do payload com hierarquia `registration → proposal → card`; adicionar validação mínima e resposta `{ success:false, skipped:true, reason }`; manter `event: "consorcio.carta.cadastrada"` e a estrutura `lead / carta / proposta / registration` para não quebrar o cenário no Make.
- `src/hooks/useConsorcioPendingRegistrations.ts`: remover as 3 chamadas extras a `dispatchCartaCadastradaWebhook` (linhas ~545, ~692, ~1074), mantendo a de criação.
- `src/lib/consorcioCartaWebhook.ts`: só gravar `webhook_carta_cadastrada_enviado_em` quando a resposta indicar envio real (não em `skipped`).
- Nenhuma mudança de schema é necessária.

## Validação

Chamar a edge function via curl com o `registration_id` de uma carta recém-cadastrada e conferir no log que todos os campos do bloco `carta` vêm preenchidos; depois um teste com registro incompleto para confirmar o `skipped`.
