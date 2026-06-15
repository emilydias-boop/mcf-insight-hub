## Objetivo

Adicionar **A017** como uma nova linha no card "Funil por Canal — Fotografia da janela" (rota `/bu-incorporador/relatorios`), com a mesma estrutura de colunas e drill-down do A010.

## Como o A017 será detectado

Combinando suas duas respostas:

1. **Identificação do canal A017 no deal** → tag `A017` no `crm_deals.tags` (a tag já é gravada pelo `hubla-webhook-handler` quando uma venda A017 é processada).
2. **Desempate quando o lead tem A010 + A017** → vence o **que foi comprado primeiro pela Hubla** (menor `sale_date` em `hubla_transactions`).
   - Compra A010 = `product_category = 'a010'`
   - Compra A017 = `offer_id = 'sSUhrvi36mbjRN8gOwhs'` **OU** (`product_category = 'ob_construir_alugar'` AND `product_name ILIKE '%construir%alugar%'`) — mesma whitelist usada pelo webhook (`A017_OFFER_IDS`) + fallback pelo produto Hubla compartilhado.

Se o lead tem só tag `A017` (sem compra A010) → A017.
Se tem compra A010 e nenhuma marca A017 → continua A010 (regra atual, inalterada).
Se tem ambas → o canal é determinado pela primeira `sale_date` Hubla.

## Mudanças (apenas frontend/lógica de relatório)

**Arquivo único:** `src/hooks/useChannelFunnelReport.ts`

1. Adicionar `A017: 'A017'` em `CHANNEL_LABELS` e em todas as listas/inicializações de canais (`FUNNEL_CHANNELS`, `blankDetails`, totais).
2. Estender o lookup que hoje busca a venda A010 mais recente (`product_category='a010'`) para também buscar a **venda A017 mais antiga** (offer_id whitelist + fallback de produto) e guardar em um `Map<email, Date>`.
3. Criar `classifyChannelWith30dRuleV2` (substitui o atual) com a regra:
   - Se deal tem tag `A017` **sem** compra A010 → `A017`.
   - Se deal tem compra A010 **e** compra A017 → comparar datas; menor `sale_date` vence (`A010` ou `A017`).
   - Se deal tem compra A010 e tag `A017` mas sem `hubla_transaction` A017 detectável → assume `A017` (a tag indica venda).
   - Caso contrário, mantém o comportamento atual (A010 / ANAMNESE / ANAMNESE_INCOMPLETA / OUTROS).
4. Atualizar os 3 pontos do hook que classificam canal (carrinho R2, vendas Hubla extras e meta de deal) para passar também `mostRecentA017Purchase` / `hasA017Tag`.

## O que NÃO muda

- Nenhuma alteração em schema/migrations.
- Nenhuma alteração no webhook Hubla — ele já grava a tag `A017` corretamente.
- Outros relatórios (`SalesReportPanel`, `useAcquisitionReport`, `useCarrinhoAnalysisReport`) ficam como estão; este plano cobre apenas o card "Funil por Canal".
- Layout da tabela: A017 aparece como uma nova linha entre A010 e OUTROS. As 5 colunas (Entradas, R1 Agend., R1 Realiz., No-Show, Contrato Pago) e os 5 cards de conversão funcionam automaticamente para o novo canal.

## Validação após implementar

- Conferir no preview que a linha A017 aparece com números > 0 (existem deals com tag A017 hoje).
- Checar que `A010 + OUTROS + A017 + ANAMNESE + ANAMNESE INCOMPLETA = Total` continua batendo.
- Abrir o drill-down de uma célula A017 e validar que os leads listados têm tag `A017`.
