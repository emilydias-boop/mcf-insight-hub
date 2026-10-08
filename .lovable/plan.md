# Investigação: modal de detalhe do closer (Faturamento por Closer)

Somente leitura. Nenhum código foi alterado. Aprovar esta "plano" não muda nada no sistema; é só o relatório.

## 1) Onde aparece

- Componente: `src/components/relatorios/CloserRevenueDetailDialog.tsx` (710 linhas)
  - "Comparativo com mês anterior": L574-612
  - "Melhor Dia" / "Pior Dia": L614-640
  - "Detalhamento de Parcerias": L642-675
- Aberto por `CloserRevenueSummaryTable.tsx` L643 (clique numa linha da tabela "Faturamento por Closer / SDR / Canal"), com `transactions={selectedTxs}` (L442: `closerTransactionsMap.get(selectedCloser.id)`).
- A tabela fica em `SalesReportPanel.tsx` L991 → `BUReportCenter.tsx` L82 (`selectedReport === 'sales'`) → página `src/pages/bu-incorporador/Relatorios.tsx`.
- Rota: `/bu-incorporador/relatorios` (App.tsx L370, guard `relatorios`) → Central de Relatórios → tipo "Vendas" → clicar no closer.

## 2) Origem dos dados

Período atual (vem do pai, SalesReportPanel L85-100):
- BU incorporador: `useAllHublaTransactions` → RPC `get_all_hubla_transactions(p_search, p_start_date 00:00-03:00, p_end_date 23:59:59-03:00, p_limit 5000, p_products)`.
- Outras BUs: `useTransactionsByBU` → RPC `get_hubla_transactions_by_bu(p_bu, …)`.
- Filtro de categoria (Summary L148-155, só incorporador): `ALLOWED_INCORPORADOR_CATEGORIES` = contrato, incorporador, parceria, a010, renovacao, ob_vitalicio, contrato-anticrise, p2 (+ categoria vazia).
- Atribuição ao closer: RPC `atribuicao_closer_vendas` via `useAtribuicaoCloser` (Summary L157, L355-379). O array do closer inclui outside e P2 (L376-378: `arr.push(tx)` em ambos os ramos).
- `globalFirstIds`: RPC `get_first_transaction_ids` (useAcquisitionReport L189-196).

Mês anterior (Dialog L143-175):
```ts
startDate: subMonths(startDate, 1), endDate: subMonths(endDate, 1)
useAllHublaTransactions({ startDate, endDate })   // sempre esta RPC, mesmo fora do incorporador
prevScopedTxs = bu==='incorporador' ? filtro allowlist : tudo
prevCloserTxs = a.closer_id === closerId && !a.is_outside
```
Linhas automáticas (`__…__`) ou modo sdr/canal: comparativo desligado (L139, L159, L575).

## 3) Cálculos

Faturamento = BRUTO via `getDeduplicatedGross` (incorporadorPricing.ts L68+): consolidated_gross → parcela>1 = 0 → gross_override → não-primeira do grupo = 0 → "parceria"/A003 = product_price → reference_price → fallback.

```ts
// L284-285
totalGross = Σ getDeduplicatedGross(t, globalFirstIds.has(t.id))
totalNet   = Σ net_value
// L320-326
prevGross  = Σ getDeduplicatedGross(t, true)        // força "primeira" no mês anterior
prevCount  = prevCloserTxs.length                   // transações, não vendas
grossChange = (totalGross - prevGross)/prevGross*100
countChange = (transactions.length - prevCount)/prevCount*100
```
Assimetrias observadas (só fato, sem decisão):
- Atual inclui outside e P2 no bruto e na contagem; anterior exclui outside.
- Atual usa `globalFirstIds`; anterior força `true` (sem dedup de primeira compra).
- "transações" conta linhas brutas (inclui parcelas e reembolsos).

Melhor/Pior dia (L288-297):
```ts
for tx of transactions: day = sale_date.substring(0,10)   // prefixo da string, não convertido p/ SP
  dayMap[day] += getDeduplicatedGross(tx, globalFirstIds.has(tx.id))
days = só v > 0; ordena desc; best = [0]; worst = [último]
```
Entram todas as transações do closer (outside, P2, parcelas com bruto 0 somam 0). Pior Dia só aparece se for diferente do melhor (L628).

Detalhamento de Parcerias (L304-317): grupo `parceria` do `grupoVenda` (L87-99: categoria parceria/renovacao, nome com "renovação" ou começando com "r0"), agrupado por `product_name`; Qtd = vendas distintas `vendaKey` (cliente+produto); Bruto = `getDeduplicatedGross(tx, true)`; Líquido = Σ net_value.

## 4) Cards acima, na mesma tela (KPI grid L372-467)

Todos via `grupoStats(g)` (L267-270): count = vendas distintas `vendaKey`, gross = Σ getDeduplicatedGross (forçado `true` só para parceria), net = Σ net_value.
- Contratos (caução) — grupo contrato (A000, "contrato mcf", contrato, contrato-anticrise)
- Vendas MCF (A001·A003·A009) — grupo venda, + "A receber" (`calcRecebimento`)
- P2 — só se houver; bruto fixo "R$ 0 (regra P2)", líquido real
- Parcerias / Recorrência — só se houver
- Reembolsos — `sale_status='refunded'` ou net<0; valor = |Σ net| (L279-283)
- Outros — a010 + outros
- Contribuição Total — `totalGross`, líquido `totalNet`, e "sem P2" = totalNet − p2.net

Não existe card de Ticket Médio neste modal.

Abaixo dos cards: tabela "Vendas do período" (L178-233): consolida por `vendaKey`; total exclui outside e P2.

## Próximo passo

Nenhum. Se quiser corrigir alguma assimetria listada no item 3, diga qual e eu preparo um plano de alteração.
