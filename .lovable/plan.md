# Desenho: RPC `relatorio_diario_bu(p_data date)`

Somente leitura até aqui. (Não posso registrar a tarefa em `roadmap.md` em modo plano — só `.lovable/plan.md`; faço isso no primeiro passo da execução.)

## 1) Âncora de "Agendada" — confirmado, com uma ressalva

Sua decisão bate com o painel de Consórcio. Em `get_agenda_fatos_consorcio`, os fatos `agendada`, `realizada`, `no_show` e `fechada_agenda` são filtrados por `meeting_day = (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date`; só o fato `agendamento` usa `booked_day` (`coalesce(booked_at, created_at)`). Logo "agendada/realizada pelo dia da reunião" é exatamente o eixo do painel, e `realizada ⊆ agendada` (realizada é o subconjunto com `attendee_status='completed'` do mesmo conjunto capado).

Se usássemos `booked_at`: o funil deixaria de ser conversão. "Agendada" passaria a medir produtividade de SDR no dia (é o KPI Agendamentos, hoje 320 em ago/2026 contra 310 agendadas por reunião) e "Realizada" continuaria no dia da reunião — as duas passariam a falar de populações diferentes, e `realizada > agendada` num dia qualquer seria normal. Para relatório de funil, sua escolha é a correta.

Incorporador: `get_daily_view_incorporador` já usa `scheduled_at` para reuniões realizadas — mesma âncora. Nele não existe "R1 Agendada" pronta; teria de ser acrescentada com o mesmo predicado (`meeting_type='r1'`, `is_partner=false`, `status<>'cancelled'`, `scheduled_at::date = p_data`).

## 2) Reaproveitar × escrever — item a item

Reaproveita (a nova RPC chama a existente):

| Métrica | Reaproveita |
|---|---|
| Consórcio Reunião Agendada / Realizada | `get_agenda_fatos_consorcio(p_data, p_data)`, contando `fato='agendada'` / `'realizada'` |
| Incorporador R01 Realizada | `get_daily_view_incorporador(p_data,…)` → soma `closers[].reunioes_realizadas` |
| Incorporador Contrato Pago | mesma RPC → soma `closers[].contratos_pagos` (âncora `contract_paid_at`) |

Escrever novo em SQL:

| Métrica | Por quê / de onde |
|---|---|
| Incorporador R01 Agendada | não existe RPC; mesmo predicado da diária, contando deals distintos com `scheduled_at::date = p_data` |
| Incorporador R02 Agendada / Realizada | hoje só existe no front (`useR2MeetingSlotsKPIs.ts:40-78`). Portar direto: `meeting_type='r2'`, agendada = `status not in ('cancelled','rescheduled')`, realizada = `status in ('completed','contract_paid','refunded')`. **Descartar o hack de +3h** das linhas 33-36 e usar `AT TIME ZONE 'America/Sao_Paulo'` — no SQL isso é resolvido corretamente, e o valor pode divergir do card do front em reuniões de borda (21h–00h) |
| Incorporador Venda Realizada | hoje `deal_activities.to_stage='Venda realizada'` por `created_at` (`useR2VendasKPIs.ts:19-24`). Portável em 5 linhas |
| Incorporador Faturamento Líquido | portar o filtro de `useChannelFunnelReport` (ver ponto 4) |
| Incorporador Ticket Médio | derivado (ponto 5) |
| Consórcio Venda Realizada | clientes distintos por `clienteKey` (`useConsorcioCotasContratadas.ts:201`) |
| Consórcio Cotas Contratadas | `consortium_cards` por `data_contratacao` |
| Consórcio Consórcios Efetivados | soma de `consortium_cards.valor_credito` das mesmas cotas |
| Consórcio Produção Gerada | ver ponto 3 — o item de risco |
| Consórcio Ticket Médio | derivado |
| Solar Reunião Agendada / Realizada | novo: mesma consulta de `get_agenda_fatos_consorcio` mas com `cl.bu = 'solar'`. Recomendo **generalizar a função existente** para receber a BU em vez de duplicá-la — mas isso mexe numa RPC em produção; alternativa segura é uma consulta inline na nova RPC com o mesmo predicado |
| Solar Venda / Produção / Ticket | **sem fonte** — a RPC devolve `null` com `status: 'sem_fonte'`, nunca 0 |

Contrato de saída sugerido: JSON `{ data, gerado_em, bus: [{ bu, metricas: [{ chave, rotulo, valor, status }] }] }`, com `status ∈ ('ok','sem_fonte','provisorio')`. O `provisorio` é o que resolve o ponto 6.

## 3) Produção Gerada — o risco real

**(a) Dá para portar fielmente?** Sim, tecnicamente: as três pernas e os quatro caminhos de dedup são todos joins e `NOT EXISTS`, e em SQL ficam mais curtos e mais seguros que os ~300 linhas de TS (que hoje pagam paginação em `chunk()` só por causa do limite de 1000 linhas do PostgREST). Mas fiel exige replicar também a cadeia de atribuição (`created_by` → `profiles` → `closers`, com fallback dono do deal) — e é aí que a divergência nasce, não nas pernas.

**(b) Caminho de dedup mais frágil em 1 dia:** o caminho 4 (`consorcio_pending_registrations.proposal_id`). O comentário do hook é explícito: sem ele, agosto/2026 infla R$ 2,09 mi contando o mesmo crédito na perna A e na perna B. Numa fatia de 1 dia o risco piora, porque proposta e cadastro podem ter âncoras em **dias diferentes** (`aceite_date` da proposta vs `aceite_date` do cadastro): a dedup por "existe proposta vinculada" continua correta, mas a venda cai no dia da proposta, e um relatório diário do outro dia parece ter perdido dinheiro. A perna C (`data_contratacao` estrita) é a segunda mais frágil: chega com atraso de dias.

**(c) Alternativa melhor que reimplementar:** sim, e é a que eu recomendo — **não fatiar Produção Gerada por dia dentro da RPC nova**. Duas opções, em ordem de preferência:
1. Extrair a regra para **uma RPC própria** (`consorcio_producao_gerada(p_ini, p_fim)`) que se torne a fonte única, e depois **apontar o hook do front para ela**, deletando o TS. Assim existe um só lugar; o relatório diário chama com `p_ini = p_fim = p_data`. Custo: uma migration e um ajuste no painel (fora do escopo "somente RPC").
2. Escrever a RPC nova e deixar o TS como está. Custo: duas implementações da mesma regra, divergência garantida no médio prazo. É o cenário que você quer evitar.

Recomendação: opção 1, mas com o teste do ponto 7 rodando lado a lado (RPC × painel) antes de trocar o hook.

## 4) Faturamento Líquido do Incorporador — filtro real

`src/hooks/useChannelFunnelReport.ts:717-730`:

```ts
.from('hubla_transactions')
.select('id, customer_email, customer_phone, product_name, product_price, sale_date')
.in('product_category', ['incorporador', 'parceria'])
.eq('sale_status', 'completed')
.in('source', ['hubla', 'kiwify', 'manual', 'mcfpay'])
.gte('sale_date', windowStartIso).lte('sale_date', windowEndIso)
```
E depois, em memória (linha 730): `PARCERIA_VENDA_PRODUCTS.has(t.product_name)` — ou seja **há coluna de categoria (`product_category`) E lista branca de `product_name`**. Não existe coluna de BU: a separação Incorporador × Consórcio é feita por `product_category in ('incorporador','parceria')` mais a lista de produtos de parceria. Consórcio não passa por essa tabela (produção vem de `consorcio_*` / `consortium_cards`).

Dedup: `seen.add(email)` — **um e-mail conta uma vez na janela**. Numa fatia diária a dedup é intradiária, então a soma de 30 dias > o mês fechado quando o mesmo cliente compra em dias diferentes.

**"Líquido" ali é preço cheio recebido no Hubla** (`product_price`), sem dedução de taxa, imposto ou chargeback. É "líquido" apenas por oposição ao "bruto" = `reference_price` de tabela (`product_configurations`). Se o dono espera líquido fiscal, isso **não existe no sistema** e precisa ser dito.

## 5) Ticket Médio

- Incorporador = Faturamento Líquido ÷ Venda Realizada: coerente, **mas** os dois numeradores vêm de fontes diferentes (Hubla `sale_date` × `deal_activities.created_at`), então o denominador não é o mesmo universo do numerador. Mais consistente: Faturamento Líquido ÷ nº de vendas Hubla do mesmo filtro (o `vendaFinal` do funil). Preciso da sua decisão.
- Consórcio = Consórcios Efetivados ÷ Venda Realizada: **confirmado**, é literalmente o que a aba Closers faz — tooltip em `src/components/sdr/ConsorcioCloserSummaryTable.tsx:232`: "Consórcio Efetivado ÷ Vendas Realizadas. Uma venda = um cliente, mesmo que ele contrate várias cotas."
- Solar: `sem_fonte`.

## 6) Reprocessamento de 7 dias — a forma mais enxuta

Nada parecido existe reutilizável: `weekly_metrics` é semanal e alimentada por outro caminho (lida por `weekly-bu-report/index.ts`), com granularidade e chave erradas para isto.

Proposta mínima: **uma** tabela, chave natural, upsert pela própria RPC.

```text
relatorio_diario_snapshots
  data date, bu text, metrica text, valor numeric null,
  status text, gerado_em timestamptz, revisao int
  PK (data, bu, metrica)
```
Formato longo (uma linha por métrica) em vez de uma coluna por métrica: métrica nova não pede migration. A RPC, ao rodar para `p_data`, recalcula `p_data` e os 6 dias anteriores, compara com o snapshot, faz upsert incrementando `revisao` quando o valor muda, e devolve no JSON o delta (`valor_anterior`) para os dias que mudaram. Com isso o relatório de amanhã pode dizer "ontem foram 12; o dia 28 subiu de 9 para 11".

Uma tabela, uma PK, nenhum job de limpeza obrigatório. Precisa de GRANTs + RLS (leitura para papéis de gestão, escrita só `service_role`) e de migration — logo, é a única peça de escrita do plano.

## 7) Teste de aceite — atenção: os números não fecham com a consulta crua

Rodei os SELECTs antes de prometer. **Não reproduzem os seus números**, e o motivo é o filtro de funil aplicado no painel, não a regra:

`select fato, count(*) from get_agenda_fatos_consorcio('2026-08-01','2026-08-31') group by 1`:
- agendada **310** (você espera 274) · realizada **222** (você espera 183) · no_show 71 · fechada_agenda 9 · agendamento 320

`consortium_cards` com `data_contratacao` em agosto/2026:
- cotas **117** (você espera 84) · crédito **R$ 17.760.000** (você espera 13.600.000 de Efetivado e 17.610.000 de Produção) · clientes distintos **42** (você espera 31 vendas)

Diagnóstico: o painel **não** consome a RPC crua. `src/pages/bu-consorcio/PainelEquipe.tsx:113-126,402-411` monta `allowedOriginNames` a partir do funil selecionado e filtra os fatos por `origin_name`; e `useConsorcioCotasContratadas(start, end, allowedOriginNames, BU_SQUAD)` (linha 329) separa resíduos que **saem** do total dos closers (`creditoSemVinculo`, `creditoSemCloser`, `creditoCadastroSemLead`, `creditoForaFunil`). Isso explica 117→84 cotas, 42→31 clientes e 17,76 mi→13,6 mi. Não é arredondamento: é escopo.

**Consequência para o desenho:** a RPC precisa receber o mesmo escopo do painel, ou o teste de aceite nunca passa. Preciso da sua definição antes de escrever:
- (i) qual funil/origens estavam selecionados quando os números 274/183/31/84/13,6 mi foram lidos, e
- (ii) se o relatório diário deve seguir esse escopo (com resíduos fora) ou reportar o total da BU (com resíduos dentro). São números diferentes e ambos defensáveis.

Motivos já identificados para a soma diária **não** fechar com o mês, independentemente disso:
- **Cap de 2 por deal**: em `get_agenda_fatos_consorcio` o `ROW_NUMBER() … PARTITION BY unit_key ORDER BY meeting_day` capa 2 por deal **na janela**. Numa janela de 1 dia o cap quase não morde; somando 31 dias, um deal com 4 reuniões no mês entra 4 vezes contra 2 no mês fechado. **A soma diária será ≥ o mês.**
- **Dedup por dia**: a dedup é `(unit_key, meeting_day)`, então é estável no recorte diário — este não quebra.
- **Faturamento Líquido**: dedup por e-mail **dentro da janela** ⇒ soma diária ≥ mês.
- **Produção Gerada**: âncora retroativa (`aceite_date`) ⇒ o valor de um dia muda depois; é o caso de uso do snapshot do ponto 6.
- **Cotas / Efetivado**: `data_contratacao` chega com atraso ⇒ D-1 sempre subestimado; a janela de 7 dias cobre parte, não tudo.
- Arredondamento não é problema (crédito é inteiro; só Ticket Médio arredonda, e é derivado).

## Decisões que preciso de você antes de escrever

1. Escopo do Consórcio na RPC: total da BU ou escopo do painel com resíduos fora (e qual funil).
2. Ticket Médio do Incorporador: denominador `deal_activities` ou vendas Hubla.
3. Produção Gerada: extraio para RPC própria e aponto o painel para ela (fonte única), ou duplico a regra em SQL.
4. Cap de 2 por deal: mantenho no diário (soma ≥ mês) ou o relatório diário ignora o cap e assume divergência com o mês.
