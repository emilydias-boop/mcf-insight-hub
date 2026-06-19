## Objetivo
Tornar o `hubla-webhook-handler` resiliente a telefones duplicados em `crm_contacts`, fazendo **upsert** (criar ou atualizar) em vez de só INSERT. Assim o webhook nunca trava por conflito de unicidade e novas vendas A010 continuam entrando.

## Diagnóstico
Hoje o handler tenta `INSERT` em `crm_contacts`. Quando outro contato já existe com o mesmo telefone (últimos 9 dígitos) ou mesmo email, o Postgres devolve erro de unique constraint, a função aborta e o deal nunca é criado — foi o que vimos no backfill dos 23 leads.

## Mudança proposta (somente no edge function)

No `supabase/functions/hubla-webhook-handler/index.ts`, no trecho que cria o `crm_contact` para A010:

1. **Normalizar telefone** uma vez (`right(regexp_replace(phone,'\D','','g'), 9)`) e email (`lower(trim(email))`).
2. **Buscar contato existente** antes de inserir, na ordem:
   - a) por email normalizado
   - b) se não achar, por últimos 9 dígitos do telefone
3. **Se encontrou** → fazer `UPDATE` no contato:
   - Atualiza `name`, `phone`, `email` (se vazios), adiciona tags `A010` / `A010 Hubla` sem duplicar, garante `origin_id = PIPELINE INSIDE SALES` se ainda não tiver origin, e atualiza `clint_id` para `hubla-backfill-<hubla_id>` apenas se estiver null.
   - Usa o `id` desse contato para criar o deal.
4. **Se não encontrou** → `INSERT` igual ao fluxo atual.
5. **Try/catch** envolvendo o passo de contato: se mesmo assim houver erro (ex.: corrida com outro webhook simultâneo criando o mesmo telefone), capturar `code === '23505'` (unique violation), re-buscar o contato pelo email/telefone e seguir com o deal — nunca abortar a venda.
6. **Logs**: registrar em `hubla_webhook_logs` quando um contato foi reaproveitado por telefone vs. email vs. criado novo, para auditoria.

## Fora do escopo
- Não mexer em schema, RLS ou tabelas.
- Não criar job de monitoramento nem tela de auditoria (opções b/c da mensagem anterior). Só blindagem do handler.
- Não alterar a lógica de criação de deal — só garante que o contato exista antes.

## Validação
- Reprocessar manualmente 1 venda Hubla A010 cujo telefone já exista em `crm_contacts` (via `supabase--curl_edge_functions`) e confirmar:
  - contato existente foi atualizado (tags `A010`/`A010 Hubla` adicionadas)
  - deal foi criado em PIPELINE INSIDE SALES
  - log em `hubla_webhook_logs` indica "contato reaproveitado por telefone"
- Conferir nos logs do edge function que não há mais `duplicate key value violates unique constraint`.
