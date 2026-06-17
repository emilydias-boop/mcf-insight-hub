## Problema

Hoje, no `/crm/negocios`:

- O filtro **Canal → A010** e o **badge "A010"** nos cards do Kanban dependem de `useBulkA010Check`, que consulta `hubla_transactions` por `product_category='a010'` + `sale_status='completed'` **sem janela de data**.
- Resultado: qualquer lead que tenha comprado A010 em qualquer momento do passado recebe a tag/canal A010, mesmo que o deal atual nada tenha a ver com aquela compra.

Já temos precedente correto em `src/lib/r2ChannelClassify.ts` (R1/R2 da agenda), que usa uma janela de 30 dias (`THIRTY_DAYS_MS`) e classifica como `A010` apenas se a compra A010 mais recente for "fresca" em relação a uma data de referência.

## Objetivo

Aplicar a mesma lógica de "A010 ativo" (compra A010 recente) no CRM Negócios, tanto no filtro `Canal → A010` quanto no badge visual do card, mantendo compatibilidade com os demais consumidores (`useContractReport`, `CopyLeadsFormatDialog`) — esses não devem mudar comportamento.

## Escopo

### 1. Hook A010 com janela de data

Em `src/hooks/useBulkA010Check.ts`:

- Manter `useBulkA010Check(emails)` atual (compatibilidade com `useContractReport`, `CopyLeadsFormatDialog`) — `Map<email, boolean>` lifetime.
- Adicionar novo hook `useBulkA010LastPurchase(emails: string[])` que retorna `Map<email, string /* ISO da última compra A010 completed */>`. Mesmo chunking/concorrência atuais; muda apenas o `select` para incluir `paid_at`/`created_at` (o que já é a fonte da data da venda em `hubla_transactions`) e agrega o `max` por email.
- Reaproveitar o helper de classificação por idade já existente em `src/lib/r2ChannelClassify.ts` (`THIRTY_DAYS_MS`) — exportar/usar a janela de 30 dias.

### 2. Filtro "Canal A010" em `/crm/negocios`

Em `src/pages/crm/Negocios.tsx`:

- Substituir `useBulkA010Check` por `useBulkA010LastPurchase` no fluxo do filtro de canal.
- Para cada deal, considerar `isA010 = true` somente se:
  - existir uma compra A010 do email **E**
  - `now - lastPurchaseAt <= 30 dias` (`THIRTY_DAYS_MS`).
- Atualizar a construção do `a010Emails` Set passado para `detectSalesChannel` para conter apenas emails dentro da janela.

### 3. Badge "A010" no Kanban

Em `src/components/crm/DealKanbanBoard.tsx` e `src/components/crm/DealKanbanCard.tsx`:

- Trocar a fonte do badge `A010` para o mesmo Map "compra recente" do passo 2.
- Comportamento: leads com compra A010 > 30 dias **não** mostram mais o badge A010 no card.

### 4. Documentação / memória

- Criar `docs/qa/2026-06-17-a010-janela-30d-negocios.md` documentando: regra antiga (lifetime), regra nova (30 dias), arquivos alterados, impacto esperado (ex.: queda de cards marcados como A010 para os históricos).
- Atualizar `mem://business-logic/...` com regra: "Canal/badge A010 no /crm/negocios usa janela de 30 dias da última compra A010 (mesma regra do R1/R2)".

## Fora de escopo

- Não mudar `useContractReport` nem `CopyLeadsFormatDialog` (continuam lifetime).
- Não mudar a tela `Recuperação A010` (já opera sobre a data da transação Hubla, não sobre lifetime).
- Não mudar o RPC `get_all_hubla_transactions`.
- Não mudar a janela de 30 dias — usaremos a mesma constante já consolidada.

## Validação

1. Pegar um deal cujo contato comprou A010 em data antiga (>30 dias antes de hoje, 17/06/2026):
   - Antes: aparece com badge "A010" e entra no filtro Canal A010.
   - Depois: **não** aparece como A010.
2. Pegar um deal cujo contato comprou A010 em 16/06/2026:
   - Antes e depois: aparece como A010.
3. Conferir contagem no filtro Canal A010 antes/depois — deve cair para o número de compradores "ativos" (≤30 dias).

## Detalhes técnicos

- `hubla_transactions`: filtros `product_category='a010'`, `sale_status='completed'`; campo de data utilizado para "última compra" é o mesmo já consumido pelos relatórios (`paid_at` quando disponível, com fallback para `created_at`); aplicar `MAX(...)` por email no client após o `select`.
- Janela: `THIRTY_DAYS_MS` de `src/lib/r2ChannelClassify.ts`.
- Garantir que `queryKey` do novo hook inclua a lista ordenada de emails para reuso do cache, exatamente como hoje.
