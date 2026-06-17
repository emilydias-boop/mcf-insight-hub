---
name: A010 channel 30d window in /crm/negocios
description: O filtro Canal A010 e o badge A010 do Kanban em /crm/negocios usam janela de 30 dias da última compra A010 (THIRTY_DAYS_MS), mesma regra do R1/R2.
type: feature
---

No /crm/negocios, o filtro **Canal → A010** e o badge **A010** dos cards do
Kanban consideram apenas leads cuja compra A010 mais recente está dentro de
`THIRTY_DAYS_MS` (constante em `src/lib/r2ChannelClassify.ts`).

- Hook usado: `useBulkA010CheckRecent` em `src/hooks/useBulkA010Check.ts`.
- Filtros Hubla: `product_category='a010'` + `sale_status='completed'`.
- Data considerada: `sale_date` (fallback `created_at`), agregada por `MAX` por email.
- `useBulkA010Check` (lifetime) continua existindo para `useContractReport` e
  `CopyLeadsFormatDialog` — não trocar sem verificar impacto nesses fluxos.