# Reconciliação Consórcio 01–26/08/2026 e ajuste da função

## Resultado da comparação (soma dos 26 dias vs painel)

| métrica | soma dos 26 dias | painel | bate? |
|---|---|---|---|
| reuniao_agendada | 271 | 268 | não (+3) |
| reuniao_realizada | 200 | 198 | não (+2) |
| venda_realizada | 36 | 33 | não (+3) |
| producao_gerada | 16.220.000 | 16.220.000 | sim |
| cotas_contratadas | 89 | 89 | sim |
| consorcios_efetivados | 14.370.000 | 14.370.000 | sim |
| ticket_medio | 7.189.583 (soma sem sentido) | 435.455 | não somável |

## Ponto 1 — Vendas Realizadas = 33

Rodei as duas fontes no recorte inteiro:

- clientes distintos das cotas contratadas (`consortium_cards`, `tipo_registro='contratacao'`, identidade CPF/CNPJ com fallback no nome, igual a `clienteKey` em `src/hooks/useConsorcioCotasContratadas.ts:201`): **33** — é essa.
- campo `vendas` dentro de `consorcio_producao_gerada('2026-08-01','2026-08-26','consorcio')`: **40** — não é essa.

Ou seja: a métrica do painel é pessoa distinta que contratou cota no período, não venda de proposta aceita. Na função diária eu contei o mesmo eixo, mas por dia — e a soma dá 36 porque 3 clientes contrataram cotas em dias diferentes e são contados uma vez no período e duas vezes na soma diária.

## Ponto 2 — fórmula literal do Ticket Médio

`src/components/sdr/ConsorcioCloserSummaryTable.tsx:181`

```ts
const totalTicket = totals.clientes > 0 ? totals.credito / totals.clientes : null;
```

`totals.credito` é o Consórcio Efetivado (`ConsorcioCloserSummaryTable.tsx:137`) e `totals.clientes` é o distinct global de clientes (`:135-136`). Confere: 14.370.000 / 33 = 435.454,5 — é o número do painel. Não é média de tickets por closer e **não** é produção ÷ vendas, que é o que a função faz hoje.

## Ponto 3 — reuniões: a diferença é dedup de período, sim

Fonte é `get_agenda_fatos_consorcio`. No período: `agendada`=268, `realizada`=198 (idêntico ao painel). Somando dia a dia: 271 e 200.

Causa medida: **3 deals** têm mais de 2 dias com fato `agendada` no recorte; o cap de 2 por deal age no período inteiro e não na fatia diária. Mesmo mecanismo explica +2 em realizada. Confirmado: essas métricas **não são somáveis por dia** — a soma de 26 dias é sempre ≥ o valor do período.

## Consequência para o relatório diário

O relatório diário é um retrato do dia (D-1), não uma parcela que reconstrói o mês. Métricas com dedup por deal/cliente (reuniões, vendas realizadas) não devem ser somadas entre dias; o fechamento do mês continua sendo lido no painel/período. Produção, cotas e efetivado são aditivos e somam exato.

## Mudança que proponho aplicar na função (depois do seu ok)

Uma única migration de função, sem tocar em dados ou tabelas:

1. Remover as 5 linhas `bu='solar'` → a função passa a devolver **15 linhas** (8 incorporador + 7 consórcio).
2. `consorcio.ticket_medio` passa a ser `consorcios_efetivados / venda_realizada` (crédito efetivado ÷ clientes distintos do dia), exatamente a conta da linha 181 do painel, em vez de produção ÷ vendas internas.
3. `consorcio.venda_realizada` fica como está (clientes distintos do dia, mesmo `clienteKey`) — é o mesmo eixo do painel, só recortado no dia. Documentar no comentário da função que é métrica não somável.
4. Sem mudança em produção, cotas, efetivado e em nenhuma métrica do incorporador.

Depois de aplicar: rodar 26/08 e 03/09 e trazer a saída bruta, ler `/tmp/observability/build-errors.log`, build e typecheck. Sem publicar.
