# A010 com janela de 30 dias no /crm/negocios

Data: 17/06/2026

## Problema
O filtro **Canal → A010** e o badge **A010** dos cards do Kanban em `/crm/negocios`
marcavam como A010 qualquer lead cujo email tivesse **alguma** `hubla_transactions`
com `product_category='a010'` e `sale_status='completed'`, sem limite de data
(`useBulkA010Check`). Resultado: leads que compraram A010 há meses/anos voltavam
a aparecer como A010 em deals atuais.

## Regra nova
Reaproveitar a constante `THIRTY_DAYS_MS` já usada em `src/lib/r2ChannelClassify.ts`
(R1/R2 da agenda). Um lead só é considerado **A010 ativo** se a compra A010 mais
recente do email estiver dentro dos últimos 30 dias em relação a `now()`.

- Fonte de data: `hubla_transactions.sale_date` (fallback `created_at`).
- Filtros: `product_category='a010'`, `sale_status='completed'`.
- Agregação: `MAX(sale_date)` por email, comparado com janela.

## Arquivos alterados
- `src/hooks/useBulkA010Check.ts` — adicionado `useBulkA010CheckRecent(emails, windowMs?, referenceISO?)`.
- `src/pages/crm/Negocios.tsx` — passou a usar `useBulkA010CheckRecent` para popular `channelMap`.

## Não muda
- `useBulkA010Check` (lifetime) segue existindo e é consumido por
  `useContractReport` e `CopyLeadsFormatDialog` — comportamento inalterado.
- Tela `Recuperação A010`, RPC `get_all_hubla_transactions` e relatórios de
  aquisição/origem não foram tocados.

## Impacto esperado
- O filtro Canal A010 e o badge A010 do Kanban passam a refletir compradores
  recentes (≤30d). Leads com compra A010 antiga deixam de aparecer marcados.

## Validação manual
1. Lead com última compra A010 há >30 dias → não aparece com badge A010 no
   Kanban e some do filtro Canal A010.
2. Lead com compra A010 nos últimos 30 dias → continua aparecendo.
3. Contagem do filtro Canal A010 cai em relação à versão anterior.