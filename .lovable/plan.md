## Causa

A edge `transfer-deals-to-bu` insere novos deals com `data_source: "bu_transfer"`, mas a coluna tem CHECK constraint que só permite `csv | webhook | manual | bubble | replication`. Todo insert falha e o log fica `[object Object]` porque o erro é PostgrestError, não Error.

## Correção

1. Trocar `data_source: "bu_transfer"` por `"replication"` em `supabase/functions/transfer-deals-to-bu/index.ts` (mantém rastreabilidade via `replicated_from_deal_id` + activity `bu_transfer`).
2. Melhorar log: `console.error(..., JSON.stringify(err))` para que futuros erros apareçam legíveis.
3. Redeploy da função.

Sem migração de banco, sem mudanças de UI.