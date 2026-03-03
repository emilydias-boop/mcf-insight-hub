

## Problema encontrado

Os logs da edge function mostram que **todos os deals estão falhando** com o erro:

> `Could not find the 'status' column of 'crm_deals' in the schema cache`

A tabela `crm_deals` **não tem** uma coluna `status`. A edge function está tentando inserir `status: 'open'` no insert, mas essa coluna não existe.

Por isso os batches estão "processando" mas nenhum deal está sendo criado — todos caem no `catch` e são contados como `skipped`.

## Correção

### `supabase/functions/import-spreadsheet-leads/index.ts`
- **Remover** `status: 'open'` do insert de `crm_deals`
- O insert ficará apenas com: `name`, `contact_id`, `origin_id`, `stage_id`, `tags`, `clint_id`

### Melhoria de feedback
- Após o fix, o progresso já funciona corretamente (batch X/44 + barra de progresso)
- Adicionar log no console do resultado de cada batch para debug

