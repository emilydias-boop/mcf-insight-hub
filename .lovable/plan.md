

## Plano: Filtrar parceiros da detecção de Outside

### Problema
O hook `useOutsideDetectionForDeals` busca transações com `product_category IN ['contrato', 'incorporador']` e `product_name ILIKE '%contrato%'`. Porém, **não verifica se o contato já é parceiro** (comprou A001, A009, A002, A003, A004, Incorporador, Anticrise). Parceiros que possuem contrato aparecem como "Outside" quando na verdade são vendas realizadas de parceiros existentes.

### Solução

**Arquivo**: `src/hooks/useOutsideDetectionForDeals.ts`

Adicionar uma query paralela para buscar emails de parceiros (mesma lógica do `checkIfPartner` usado nos webhooks) e excluí-los do resultado Outside. Deals de parceiros receberão um flag `isPartner: true` em vez de `isOutside: true`.

Alterações:
1. Na query paralela (step 3), adicionar busca de transações de parceiros:
   - `hubla_transactions` com `sale_status = 'completed'` onde `product_name` contém A001, A002, A003, A004, A009, INCORPORADOR ou ANTICRISE
2. Construir um `Set<string>` de emails de parceiros
3. No step 6 (determinação de Outside), **pular** emails que são parceiros — esses deals NÃO devem ser marcados como Outside
4. Expandir o tipo de retorno para incluir `isPartner` para que o UI possa diferenciar

**Arquivo**: `src/components/crm/DealKanbanCard.tsx`

Atualizar o tipo `outsideInfo` para incluir `isPartner` e não mostrar badge Outside para parceiros.

**Arquivo**: `src/pages/crm/Negocios.tsx`

Atualizar filtro `outsideFilter` para excluir parceiros dos resultados Outside.

### Resumo

| Arquivo | Alteração |
|---|---|
| `src/hooks/useOutsideDetectionForDeals.ts` | Buscar emails de parceiros e excluí-los da detecção Outside |
| `src/components/crm/DealKanbanCard.tsx` | Adaptar tipo para `isPartner` |
| `src/pages/crm/Negocios.tsx` | Filtro Outside ignora parceiros |

