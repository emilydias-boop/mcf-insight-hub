## Reenvio manual do webhook para "Pedro Rodrigues dos Santos Filho"

Objetivo: disparar o webhook `consorcio-carta-cadastrada-webhook` (Make) para a carta do Pedro para você validar o payload no Make, sem alterar código.

### Passos
1. Localizar o `card_id` e o `registration_id` da carta do Pedro Rodrigues dos Santos Filho em `consortium_cards` / `consorcio_pending_registrations` (via `read_query`).
2. Chamar a edge function `consorcio-carta-cadastrada-webhook` com `curl_edge_functions`, passando `{ card_id, registration_id }` no body. Isso reenvia mesmo se já foi enviado antes (a edge function não checa a flag; a idempotência está no client `dispatchCartaCadastradaWebhook`).
3. Ler os logs da função (`edge_function_logs`) para confirmar HTTP 200 do Make e retornar o status para você.

### Observações
- Não haverá mudança de código nem de banco.
- Se preferir usar o botão "Reenviar webhook" existente na UI de Concluídas - Operacional, ele já faz o mesmo (com `force=true`) — posso apenas te orientar a clicar. Este plano é para eu disparar pelo backend.
