## Objetivo
Disparar um POST de teste para a edge function `consorcio-carta-cadastrada-webhook` para validar que o Make recebe o payload corretamente.

## Como
1. Buscar via `supabase--read_query` o `registration_id` mais recente com status `cota_aberta` (já concluído em "Concluídas - Operacional"), junto com seu `card_id` e `proposal_id`.
2. Chamar a edge function via `supabase--curl_edge_functions` com método POST em `/consorcio-carta-cadastrada-webhook` passando `{ card_id, registration_id, proposal_id }`.
3. Ler `supabase--edge_function_logs` da função para confirmar o status HTTP retornado pelo Make (esperado 200).
4. Reportar ao usuário: status do Make, id da carta usada no teste e trecho da resposta.

## Fora de escopo
- Não altero código nem payload da função.
- Não crio registros novos no banco — uso uma carta já cadastrada como amostra.