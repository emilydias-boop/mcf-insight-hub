# Produção Gerada — o furo das etapas 4 e 5, medido

Rodada de medição. Nenhum código, nenhuma migração, nenhum dado tocado.

## Veredito: o mecanismo que você descreveu está certo, mas o tamanho é outro

Confirmado ponto por ponto:

- `consortium_cards` só nasce na transição 4 → 5. **Etapa 4 não tem linha em `consortium_cards`** — só `consorcio_pending_registrations`.
- Perna B exige `tipo_registro='contratacao'` + `data_contratacao` no mês. Etapa 5 (reserva) fica fora: `tipo_registro='reserva'` tem **`data_contratacao` nula em 100% dos casos** (2 de 2).
- Valores reais de `tipo_registro` na tabela, sem supor: **`contratacao` 1.778** (1.778 com `data_contratacao`, 901 com `data_reserva`) e **`reserva` 2** (0 com contratação). Não existe terceiro valor.

**Onde eu te derrubo:** o buraco não é R$ 2,45 mi. É **R$ 1,93 mi**, porque **R$ 2,09 mi dos cadastros da etapa 4 já estão contados na perna A** — e a razão disso é um furo novo, mais grave que o próprio delta (ver "O quarto caminho", abaixo).

---

## 1. Etapa 4 órfã (agosto/2026)

Campo de data: **`created_at` do cadastro**, para a triagem. Motivo: é o único evento que existe com certeza para um cadastro sem cota (`cadastrada_at` está nulo em 91/91, `cota_aberta_at` em 84/91). Ver item 6 para a âncora que eu defendo de verdade.

91 cadastros criados em agosto. 31 sem linha em `consortium_cards`. Pelos **três** caminhos de vínculo que você fixou, 24 aparecem como "sem proposta", somando **R$ 3.780.000**. Mas:

| Recorte | n | Crédito |
|---|---|---|
| Sem card, "sem proposta" pelos 3 caminhos | 24 | R$ 3.780.000 |
| — desses, com `proposal_id` preenchido (já em perna A) | 12 | R$ 2.090.000 |
| **Etapa 4 órfã de verdade** | **12** | **R$ 1.690.000** |

Órfã de verdade, por closer:

| Vendedor | n | Crédito |
|---|---|---|
| André Duarte | 9 | R$ 1.460.000 |
| Joao Pedro Martins Vieira | 3 | R$ 230.000 |

1 dos 12 está em `status='declinada'` (R$ 500.000, André) — pela sua regra 2, conta.

## 2. Etapa 5 órfã (agosto/2026)

**2 cotas, R$ 240.000, ambas do André Duarte**, `data_reserva` 20 e 21/08, nenhuma vinculada a proposta. É o piso: a etapa 5 é minúscula porque hoje a equipe grava reserva e confirmação quase no mesmo instante — só 2 linhas `reserva` existem na base inteira.

## 3. Quanto já está na perna A

**R$ 2.090.000, em 12 cadastros, de 4 propostas `aceita` de agosto.** As quatro têm exatamente 1 carta cada, e o crédito da carta é idêntico à soma dos cadastros que ela gerou (ex.: 1 carta de R$ 960.000 → 8 cadastros de R$ 120.000). Somar a etapa 4 crua contaria esse dinheiro duas vezes.

### O quarto caminho — o furo que eu não tinha visto

Esses 12 cadastros **têm `proposal_id` preenchido** e ainda assim escapam do conjunto vinculado, porque nenhum dos três caminhos passa por `consorcio_pending_registrations.proposal_id`: não têm card (caminhos 1 e 3 morrem) e não têm linha em `consorcio_proposal_cartas.pending_registration_id` (caminho 2 morre). **O conjunto de dedup precisa de um quarto caminho: `consorcio_pending_registrations.proposal_id`.** Sem ele, qualquer correção que inclua a etapa 4 infla R$ 2,09 mi em agosto.

## 4. O delta

| Closer | Hoje | Etapa 4 órfã | Etapa 5 órfã | Corrigido |
|---|---|---|---|---|
| João Pedro | 10.040.000 | +230.000 | — | **10.270.000** |
| André Duarte | 3.480.000 | +1.460.000 | +240.000 | **5.180.000** |
| **Total** | **13.520.000** | **+1.690.000** | **+240.000** | **R$ 15.450.000** |

## 5. Deslocamento entre meses

**a. Sai de agosto: R$ 0, zero cotas.** Das 56 cotas órfãs contratadas em agosto, **todas as 56** têm o cadastro criado também em agosto (`min(created_at)` do cadastro dentro do mês). Nenhuma tem primeira aparição em julho ou antes. O furo de âncora que você apontou é **real na definição e nulo em agosto** — ele só começa a doer quando a equipe deixar cota virar o mês.

**b. Entra em agosto:** os R$ 1.930.000 do item 4.

**Saldo líquido: +R$ 1.930.000.** Trocar a âncora para "primeira aparição" não muda nada retroativo em agosto; muda o comportamento a partir de setembro.

## 6. Qual data representa "a venda apareceu no sistema"

Nulos em agosto, nos 91 cadastros: `created_at` 0 · `aceite_date` 0 · `data_contratacao` 25 · `vinculada_at` 39 · `cota_aberta_at` 84 · `cadastrada_at` 91.

- **Cadastro pendente sem cota:** `aceite_date` (0 nulos, é a data do aceite comercial informada pelo closer). `created_at` também está 100% preenchido, mas é digitação — e há divergência real: 8 cadastros com `aceite_date` 14/08 foram digitados em 19/08, e 1 declinado tem `aceite_date` 03/07 com `created_at` 03/08. **Defendo `aceite_date`.**
- **Cota aberta não contratada:** `data_reserva` (2 de 2 preenchidas). Se a cota tem cadastro, prefira o `aceite_date` do cadastro — é anterior e é a mesma venda.
- **Cota contratada:** hoje `data_contratacao`. Para "primeira aparição", o correto é o `aceite_date` do cadastro que a originou — existe em 100% das 56 órfãs de agosto.
- **Cota contratada sem cadastro nenhum:** **1.463 dos 1.780 cards não têm cadastro pendente.** Para elas **não existe data de primeira aparição confiável** — `created_at` é importação/digitação e `data_reserva` está nula em quase metade. Não vou inventar coalesce: para esse grupo a âncora honesta continua `data_contratacao` estrita, e isso tem que ser dito no tooltip.

## 7. Dupla contagem no tempo

A chave de identidade é **`consorcio_pending_registrations.id`**, e o elo para a cota é `consorcio_pending_registrations.consortium_card_id`. Ela é confiável, com dois defeitos medidos:

- **1.463 cards sem cadastro** — legado/externo. Não quebra a chave, mas define o grupo que fica na âncora antiga.
- **17 cards com mais de um cadastro apontando para eles** na base inteira; **0 em agosto**.
- **3 cadastros apontam para um `consortium_card_id` que não existe** na tabela (1 deles de agosto). Não há FK. São 3 casos, e eles seriam contados na etapa 4 e de novo se o card reaparecer.

**O que impede a dupla contagem:** contar o **cadastro** como unidade, uma única vez, e usar o card apenas quando não existe cadastro. Assim um cadastro de agosto que vira cota contratada em setembro continua sendo o mesmo registro, contado em agosto. Contar cadastro e card como duas unidades independentes é o que geraria a dupla contagem.

## 8. Conversa com os cards do funil

Não vão bater exatamente, e por motivo legítimo:

- **"Cotas a Fazer" 80 no período** conta cadastros criados no mês **e liberados** (venda com termo assinado, avulso, ou anterior a 19/08). 91 foram criados; ~11 estão travados esperando assinatura. Produção Gerada **não pode** aplicar esse filtro — a venda foi gerada mesmo sem assinatura, foi a sua própria regra 2.
- **"Cotas" 57** é contagem de cotas contratadas; Produção Gerada é crédito por venda única. Uma carta de R$ 960.000 vira 8 cotas — os eixos são diferentes por construção.
- A etapa 5 do funil usa `data_reserva`, um terceiro eixo de data.

Se você quiser que a coluna converse com o funil, o candidato é a **unidade cadastro**, que é o que a etapa 4 já conta.

## Recomendação de âncora, com os contras na cara

**Âncora híbrida declarada, unidade = cadastro:**

1. **Perna A** intacta: cartas de propostas `aceita`, `coalesce(aceite_date, proposal_date)`.
2. **Perna B passa a ser o cadastro pendente**, não a cota: todo `consorcio_pending_registrations` não vinculado a proposta (pelos **quatro** caminhos), âncora `aceite_date`, qualquer status — inclusive `aguardando_abertura`, `cota_aberta` e `declinada`.
3. **Perna C, resíduo:** `consortium_cards` **sem cadastro nenhum** e sem proposta, âncora `data_contratacao` estrita.

**Contras que você precisa aceitar:**
- A coluna passa a ter **três** âncoras, e o tooltip fica mais longo e menos vendável.
- `aceite_date` é **digitada pelo closer** — ele pode antedatar e puxar produção para o mês fechado. `data_contratacao` não tinha essa exposição.
- A perna C mantém a deriva de mês que você quer matar, e ela é grande hoje (1.463 cards históricos), mesmo que quase nada dela caia em agosto.
- Trocar a unidade de cota para cadastro **muda o significado de "cartas/vendas"** na coluna; os números de contagem que hoje aparecem no hook mudam, ainda que o crédito de agosto só suba.
- Nada disso mexe em Vendas Realizadas, Consórcio Efetivado, Cotas Contratadas ou Ticket Médio.

**A alternativa mais barata**, se você quiser evitar as três âncoras: manter tudo como está e só **acrescentar as etapas 4 e 5 órfãs com o quarto caminho de dedup**, mantendo `data_contratacao` para as cotas já contratadas. Isso fecha o furo do estoque invisível (+R$ 1,93 mi) e deixa o problema de âncora para quando ele tiver tamanho — que hoje, medido, é R$ 0.
