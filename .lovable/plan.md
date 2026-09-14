# Auditoria somente-leitura — como um contrato vira número no painel

Nada foi editado, nenhum deploy, nenhuma publicação.

## Resposta curta (o que decide o card CONTRATOS)

As transações de R$ 241,53 e R$ 482,09 **não são parcelas**: são vendas únicas de caução/contrato (bruto R$ 249 e R$ 497), gravadas pelo checkout MCF Pay, com `installment_number = 1` e `total_installments = 1`. Em 01–30/09/2026: 42 linhas de R$ 241,53 (soma R$ 10.144,26) e 86 de R$ 482,09 (soma R$ 41.459,74). No histórico completo, R$ 241,53 aparece 96 vezes para 95 clientes distintos e **zero clientes** aparecem em mais de um mês — logo não é assinatura nem parcelamento. O card CONTRATOS conta **venda**, não parcela.

---

## 1) A origem do dado

Quem escreve em `hubla_transactions` (três gravadores ativos):

- `supabase/functions/hubla-webhook-handler/index.ts:3055` — `upsert(transactionData, { onConflict: 'hubla_id' })` para eventos `NewSale` (bloco em 3016-3057), mais os mesmos upserts em 3185 e 3398 para outros eventos. `installment_number`/`total_installments` vêm de `extractSmartInstallment(invoice)` (linha 144) e `count_in_dashboard` é `false` para ids `newsale-*` (fantasma antes do pagamento) ou `net_value <= 0`.
- `supabase/functions/asaas-webhook-handler/index.ts:899-925` — grava as vendas do **MCF Pay** e do Asaas: `hubla_id = ${sourceLabel}_${paymentId}` com `sourceLabel = isHublaFormat ? 'mcfpay' : 'asaas'`, `sale_status: 'completed'`, `count_in_dashboard: true`, dedup por consulta prévia a `hubla_id` (linha 877). **É este gravador que produz as linhas de R$ 241,53 / R$ 482,09.**
- `supabase/functions/kiwify-webhook-handler/index.ts` e `import-hubla-history` / `kiwify-backfill-*` (importações e reconciliações).
- Lançamento manual pela tela: `src/hooks/useCreateCarrinhoTransaction.ts` (`hubla_id: manual-<timestamp>`, `source: 'manual'`) — usado só para parceria do R2 Carrinho.

Regra literal de "é contrato" — está dentro de `caucoes_efetivas` (CTE `ctx`):

```sql
upper(COALESCE(ht.product_code,'')) LIKE 'A000%'
 OR upper(COALESCE(ht.product_name,'')) LIKE '%A000%'
 OR upper(COALESCE(ht.product_name,'')) LIKE '%CONTRATO%'
```

Status aceitos como pago, no mesmo lugar (e repetidos em `useUnassignedContracts.ts:122`):

```sql
lower(COALESCE(ht.sale_status,'')) IN ('pago','paid','approved','completed')
```

Uma linha = um evento de pagamento. Para contrato hoje é 1 linha por venda (`installment_number = 1`, `total_installments = 1` em todas as amostras). O dedup que evita contar a mesma venda duas vezes **não é por parcela** — é por negócio, no `DISTINCT ON (COALESCE(msa.deal_id, msa.id))` da CTE `paid` de `caucoes_efetivas`, mais `min(tx_date)` na CTE `tx`. Para Outside existe um segundo dedup, por primeira compra: `useR1CloserMetrics.ts:525` chama `get_first_transaction_ids()` e descarta o que não é primeira compra do e-mail.

## 2) `caucoes_efetivas(p_from, p_to, p_bu)` — leitura do corpo

Corpo completo em `pg_get_functiondef` (129 linhas, `LANGUAGE sql STABLE SECURITY DEFINER`). Estrutura: `paid` → `enriched` → `ctx` → `tx` → SELECT final.

- **Parte da agenda, usa a Hubla só como calendário.** O universo é `meeting_slot_attendees.contract_paid_at IS NOT NULL AND is_partner = false AND status <> 'cancelled'`, com janela larga de ±400 dias. A Hubla (CTE `ctx`) só serve para *achar a data real* do pagamento.
- **Coluna de data:** `eff_date = COALESCE(t.tx_date, (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date)`, e o filtro do período é `eff_date BETWEEN p_from AND p_to`. `fonte` = `'transacao'` quando veio da Hubla, `'manual'` quando caiu no fallback do `contract_paid_at`. O casamento agenda×Hubla é por `linked_deal_id`, senão e-mail, senão últimos 9 dígitos do telefone.
- **Closer:** se o pagamento foi na própria R1 (`usa_slot = slot_meeting_type='r1' AND slot_closer_id IS NOT NULL`), vale o closer do slot; senão o closer da **última R1 não cancelada/reagendada com `scheduled_at <= contract_paid_at`** (`ORDER BY ms2.scheduled_at DESC LIMIT 1`). **SDR:** o `booked_by` do mesmo slot escolhido.
- **Reembolso:** ela **devolve** `refunded_at` (bruto, para o ranking da TV); quem exclui é o hook, em `useR1CloserMetrics.ts:501-508` — a linha reembolsada não entra em `contrato_pago` e vira `reembolsos` + `reembolsos_valor`.
- **Segment:** `NULLIF(UPPER(TRIM(cd.icp_segment)),'')` — segmento **atual** do `crm_deals`, não snapshot. `valor` = `crm_deals.value`.

## 3) `manual_sale_attributions`

Correção manual de **atribuição**, não lançamento de venda. Grava `src/components/closer/ManualSaleAttributionDialog.tsx:68-74` (`insert({ closer_id, ..., contract_paid_at })`). Entra na contagem em `useR1CloserMetrics.ts:687-698`, filtrando `business_unit = bu` e `contract_paid_at` no período, e é **somada** ao closer: `contrato_pago = contractsByCloser + manualByCloser` (linhas 720, 753, 820). É ignorada quando há filtro de segmento (não tem deal vinculado).

## 4) O balde "não atribuído" (os 47)

`src/hooks/useUnassignedContracts.ts`. Duas famílias:

- Linhas de `caucoes_efetivas` **sem closer** → `caucao_sem_r1` (tem deal) ou `caucao_sem_deal` (linhas 90-101). Sem SDR mas com closer → só órfã na aba SDRs (`caucao_sem_sdr`).
- `transacao_sem_reuniao` (linhas 116-188): transação de contrato paga no período que **não** tem `linked_attendee_id` entre as cauções do período, **não** tem `linked_deal_id` já atribuído, e cujo deal não tem nenhum `contract_paid_at` fora da janela. Note que aqui o predicado de "é contrato" é **mais frouxo** que o da RPC: não exige `net_value > 0`, não exclui `source asaas`, nem `event_type payment_received`. É por isso que entram as linhas de R$ 0,00 e as `mcfpay`.

## 5) Como cada número é montado

| onde aparece | o que soma | fonte (arquivo:linha) |
|---|---|---|
| card CONTRATOS (152) | `filteredBySDR.contratos` + `unassignedSdr.total` | `ReunioesEquipe.tsx:657-673` |
| Contrato Pago, aba Closers (111) | `caucoes_efetivas` com closer, líquido de reembolso, + atribuição manual | `useR1CloserMetrics.ts:497-510, 720` |
| Contrato Pago, aba SDRs | mesma `caucoes_efetivas`, eixo `sdr_id` (`booked_by` da R1 escolhida) | `ReunioesEquipe.tsx:549-555` |
| linha "Não atribuído" | linhas de `caucoes_efetivas` sem closer/SDR + transações órfãs | `useUnassignedContracts.ts:75-188` |
| REEMBOLSOS (6 · R$ 5.638) | `refunded_at` das mesmas linhas, dedup por deal | `useR1CloserMetrics.ts:501-506`; card em `ReunioesEquipe.tsx:675` |
| OUTSIDE (5) | RPC `outside_fora_do_funil` (contrato fora do MCF Pay e fora das ofertas CLS) | `useOutsideForaDoFunil.ts:27`; card em `ReunioesEquipe.tsx:656` |

**Por que 152 ≠ 111:** 111 são as cauções da agenda com closer identificável e líquidas de reembolso; 152 = 105 cauções no eixo SDR + 47 órfãs de `hubla_transactions` que o predicado frouxo do balde deixa entrar — e 41 dessas 47 têm reunião, só com o vínculo transação↔attendee quebrado.

## 6) A pergunta do valor

Distribuição de `coalesce(net_value, product_price)` — contratos, 01–30/09/2026:

| valor | qtd | soma |
|---|---|---|
| 482,09 | 86 | 41.459,74 |
| 241,53 | 42 | 10.144,26 |
| 0,00 | 7 | 0,00 |
| 460,76 | 5 | 2.303,80 |
| 30,06 | 5 | 150,30 |
| 399,86 / 388,10 / 43,84 / 36,11 | 1 cada | 867,91 |

Colunas que poderiam indicar parcela: `installment_number`, `total_installments`, `subtotal_cents`, `installment_fee_cents`, `payment_method`, `offer_id`/`offer_name`, `source`. Nas 5 amostras de R$ 241,53: `installment_number = 1`, `total_installments = 1`, `source = 'mcfpay'`, `event_type = 'invoice.payment_succeeded'`, `product_name = 'Contrato MCF'`, `product_price = 249`, `offer_name` = "Contrato - 249 - LIVE Launch" / "Contrato - 249 - Rodrigo". Não existe coluna de `order_id`/`subscription_id` preenchida nessas linhas.

Recorrência: R$ 241,53 → 96 ocorrências, 95 clientes distintos, **0 clientes em mais de um mês**. Conclusão: venda única (caução de R$ 249 líquida de taxa), não assinatura nem parcelamento. R$ 482,09 é o mesmo padrão para a caução de R$ 497 (`A000 - Contrato`, ofertas CLS por closer).

`NÃO DETERMINADO`: o que são as 7 linhas de R$ 0,00 e as 5 de R$ 30,06 (bruto 497 com líquido 30,06 sugere taxa/estorno parcial). Para determinar, falta olhar o `raw_data` dessas transações e a regra de `net_value` da Hubla nesses eventos.

## Nenhuma alteração proposta

Este documento é só a leitura pedida. Se aprovado, o próximo passo natural (e ainda não decidido) seria alinhar o predicado do balde "não atribuído" ao da RPC — mas isso mexe no card CONTRATOS e depende de decisão do dono.
