

## Diagnóstico: de onde vêm os números do "Funil por Canal" e o que está errado

### Como cada coluna é calculada hoje

**Fonte:** `src/hooks/useChannelFunnelReport.ts`. O funil cruza 4 fontes:

| Coluna | Fonte | Filtro | Como soma |
|---|---|---|---|
| **Entradas** | `crm_deals` criados no período, filtrados por `origin_id` da BU Incorporador | data de criação no período + BU | 1 por deal, classificado em canal |
| **R1 Agendada / R1 Realizada / Contrato Pago** | `meeting_slot_attendees` com `meeting_type='r1'` no período | data agendada no período | deduplicado por `deal_id`. **Se o mesmo deal tem R1 em 2+ dias diferentes → conta 2** (tentativa de capturar reagendamento) |
| **R2 Agendada / R2 Realizada** | Mesmo, com `meeting_type='r2'` | idem | mesma regra (×2 se 2+ dias) |
| **Aprovados / Reprovados / Próx. Semana** | RPC `get_carrinho_r2_attendees` para todas as semanas-safra que tocam o período | semana cheia | 1 por `deal_id` único, baseado em `r2_status_name` |
| **Venda Final / Faturamento** | `useAcquisitionReport.classified` — transações Hubla pagas no período, classificadas por `detectChannel` (lógica diferente!) | sale_date no período | 1 por transação. Bruto = `product_price`, Líquido = `net_value` |

A **classificação de canal** acontece em **2 lugares com regras diferentes**:
- **Para deals/R1/R2/Carrinho**: `classifyChannel()` em `src/lib/channelClassifier.ts` (lê tags, origin_name, lead_channel, data_source).
- **Para Venda Final/Faturamento**: `detectChannel()` dentro de `useAcquisitionReport.ts` (lê product_name, sale_origin, tags do deal vinculado, productCategory).

### O que validei contra o banco (preset Mês — Abril 2026, BU Incorporador)

#### Problema 1 — A coluna **"ANAMNESE (ex-LIVE) = 397"** está enganando

Validação em SQL replicando a regra:

| Canal | Tela | Banco real |
|---|---|---|
| ANAMNESE | 1625 | 1628 ✅ |
| A010 | 506 | 508 ✅ |
| ANAMNESE-INSTA | 35 | 35 ✅ |
| **ANAMNESE (ex-LIVE)** | **397** | apenas **4** deals têm tag `LEAD-LIVE` de verdade |

Os outros **393 deals** que aparecem em "ANAMNESE (ex-LIVE)" são **fallbacks**: deals cujas tags são `HUBLA`, `BASE CLINT`, `INDICAÇÃO`, `REEMBOLSO`, `OB-CONSTRUIR-ALUGAR`, `MAKE` (sem A010 junto), ou **sem nenhuma tag** (90 deals). A regra atual (`normalizeFunnelChannel`) joga todos esses no balde "LIVE" e o rótulo na UI é "ANAMNESE (ex-LIVE)".

**Resultado**: o usuário lê "397 leads vieram de Anamnese antigo (Live)" mas na verdade são **393 leads sem classificação clara + 4 leads de live verdadeiros**.

#### Problema 2 — Coluna R1 Agendada está inflada por reagendamento

Validei R1 attendees Inc-abril:

| Canal | Tela R1 Ag | Banco (deals únicos R1) |
|---|---|---|
| ANAMNESE (ex-LIVE) | 559 | 392 |
| ANAMNESE | 163 | 161 |
| A010 | 297 | 335 |
| **Total** | **1022** | **891 únicos** |

A diferença de 131 vem da regra `slot.r1Agendada += v.days.size >= 2 ? 2 : 1` (linha 276 do hook). Um deal com R1 em 2+ dias diferentes conta **2 vezes** em "R1 Agendada" mas só **1 vez** em "R1 Realizada". Isso quebra a leitura "R1 Ag → R1 Real" — o denominador foi inflado artificialmente.

Validar que isso é o que o usuário quer ou não: hoje **R1 Ag → R1 Real = 55%**, mas se contássemos só deals únicos seria **562/891 = 63%**.

#### Problema 3 — Faturamento por canal usa classificador **diferente** dos deals

A tabela mostra 558 vendas em A010 com R$ 24.927,65 líquido — esse "558" vem de `detectChannel(transações)` que olha **product_name** (`%a010%`) ou **product_category=a010**. Já as 506 "Entradas A010" vêm de `classifyDeal` que olha **tags do deal**. As regras divergem:

- Uma transação A010 sem deal vinculado entra em "Venda Final A010" mas não tem "Entrada A010" correspondente → infla `Aprovado→Venda` (398%) e `Entrada→Venda` (110.3%).
- Por isso o **OUTSIDE = 5 vendas** (transações sem R1) aparece com 0 entradas.
- Por isso a coluna **LANÇAMENTO** mostra 1 venda mas zero em tudo o resto.

Os totais batem com o resto do painel (R$ 918.334 bruto / R$ 641.549 líquido = ✅ idênticos aos cards do topo), mas **a alocação por canal diverge** entre as colunas de funil (deal-based) e a coluna de venda (transaction-based).

#### O que está correto

- Faturamento Bruto e Líquido **totais** batem com cards do topo.
- ANAMNESE, A010 e ANAMNESE-INSTA na coluna Entradas batem com banco.
- Aprovados/Reprovados/Próx. Semana vêm direto do RPC do Carrinho — corretos.

### Plano de correção (3 ajustes pequenos)

**Arquivo único:** `src/hooks/useChannelFunnelReport.ts` + label em `displayChannelLabel`.

1. **Renomear o canal "LIVE" para "OUTROS / SEM-CLASSIFICAÇÃO"** (e atualizar o label de exibição). Hoje rotular como "ANAMNESE (ex-LIVE)" mente — quase nenhum desses leads é Live. Manter um canal **"LIVE"** separado que só recebe deals com tag `LEAD-LIVE`/`LIVE` real (no abril seriam apenas 4 deals). Adicionar **"OUTROS"** como canal explícito de fallback. Nova lista: `['A010', 'ANAMNESE', 'ANAMNESE-INSTA', 'LIVE', 'OUTROS', 'OUTSIDE', 'LANÇAMENTO']`.

2. **Corrigir R1/R2 Agendada para contar deals únicos** (remover `v.days.size >= 2 ? 2 : 1` → sempre 1). Isso alinha o denominador da conversão "R1 Ag → R1 Real" com a realidade. Reuniões em 2+ dias passam a contar como 1 lead único, que é o que faz sentido para análise de funil. (Se quisermos preservar "tentativas de reagendamento", criar coluna separada "Tentativas R1" — fora deste escopo.)

3. **Adicionar tooltip explicativo no header da coluna "Entradas"** descrevendo que ela vem de `crm_deals.created_at` filtrado pela BU, e na coluna "Venda Final" descrevendo que vem das transações pagas (`hubla_transactions.sale_status='paid'`). Isso evita futura confusão sobre por que o canal A010 tem 506 entradas e 558 vendas (são fontes e janelas diferentes — uma transação paga em abril pode vir de um deal criado em março).

### Resultado esperado após o fix (Abril 2026)

| Canal | Entradas | R1 Ag | R1 Real | Venda Final |
|---|---|---|---|---|
| ANAMNESE | 1628 | 161 | ~58 | 11 |
| A010 | 508 | 335 | ~180 | 558 |
| OUTROS | 393 | 386 | ~317 | ~14 |
| ANAMNESE-INSTA | 35 | 3 | 1 | 0 |
| LIVE (real) | 4 | 6 | ~5 | 0 |
| OUTSIDE | 0 | 0 | 0 | 5 |
| LANÇAMENTO | 0 | 0 | 0 | 1 |

A leitura passa a ser honesta: o funil "OUTROS" vai mostrar que a maior parte do trabalho do time vem de leads sem origem rastreável — informação útil para investir em melhorar a tagueação na entrada.

### Fora do escopo

- Não vou unificar `classifyChannel` e `detectChannel` num único classificador (mudança grande, vai virar plano próprio).
- Não vou tocar no RPC `get_carrinho_r2_attendees`.
- Não vou adicionar coluna "Tentativas R1" (reagendamentos) — pode vir num próximo passo se você pedir.

### Reversibilidade

Mudança em ~15 linhas de 1 arquivo + 1 ajuste em label. Reverter = restaurar `* 2` e o label antigo.

