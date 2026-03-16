

## Diagnóstico: MovePartners moveu deals do Consórcio indevidamente

### Causa raiz

A Edge Function `move-partners-to-venda-realizada` (linha 49-58) busca **TODOS os deals de TODAS as BUs** sem nenhum filtro de origin/pipeline:

```text
crm_deals.select('id, name, contact_id, origin_id, stage_id, tags, value')
  → sem filtro de origin_id ou BU
```

Depois, identifica "parceiros" por email em `hubla_transactions` com produtos Incorporador (A001, A002, A003, A004, A009, INCORPORADOR, ANTICRISE). Se um contato do Consórcio comprou um produto A001/A009 no Incorporador, a função move o deal do Consórcio para "Venda Realizada" — mesmo que esse deal seja de outra BU.

### Impacto

Deals do Consórcio (e potencialmente outras BUs) que tinham contatos com compras de produtos Incorporador foram movidos para "Venda Realizada" indevidamente.

### Solução

1. **Corrigir a Edge Function** para filtrar apenas deals da BU Incorporador, usando a tabela `bu_origin_mapping` ou filtrando por `origin_id` das origens do Incorporador.

2. **Reverter os deals do Consórcio** afetados — consultar `deal_activities` onde `metadata->source = 'move-partners-to-venda-realizada'` e o `from_stage` pertence a uma origin do Consórcio, restaurando o `stage_id` original.

### Implementação

**Arquivo: `supabase/functions/move-partners-to-venda-realizada/index.ts`**
- Após buscar os stages "Venda Realizada", buscar os `origin_id` mapeados para a BU `incorporador` na tabela `bu_origin_mapping`
- Filtrar `allDeals` para incluir apenas deals cujo `origin_id` pertença ao Incorporador
- Isso impede que deals de Consórcio/Crédito/etc. sejam movidos

**Reversão dos dados (SQL via Supabase)**
- Consultar `deal_activities` com `metadata->>'source' = 'move-partners-to-venda-realizada'` para identificar deals movidos indevidamente
- Filtrar aqueles cujo `from_stage` pertence a uma origin do Consórcio (origin_id do consórcio)
- Atualizar o `stage_id` desses deals de volta para o valor `from_stage` original

