# Painel Comercial do Consórcio — "Consórcio Efetivado" e "Produção Gerada"

Rodada de levantamento. Nenhum código, nenhuma migração, nenhum dado alterado.

## 1. O que "Crédito Contratado" soma hoje

Fonte única: `src/hooks/useConsorcioCotasContratadas.ts`.

```ts
.from("consortium_cards")
.select("id, vendedor_name, data_contratacao, nome_completo, grupo, cota, valor_credito, cpf, cnpj")
.eq("tipo_registro", "contratacao")
.gte("data_contratacao", format(startDate, "yyyy-MM-dd"))
.lte("data_contratacao", format(endDate, "yyyy-MM-dd"))
```

- Tabela: `consortium_cards` (cota real na Embracon), só `tipo_registro = 'contratacao'` — reserva não entra.
- **Data de referência: `data_contratacao`** (não é data de proposta, nem de reserva, nem de cadastro).
- Valor: `sum(valor_credito)` das cotas, agregado em `creditoByCloser`.
- Closer: `consortium_cards.vendedor_name` casado por nome (primeiro|último) contra `closers` da BU consórcio. Quem não casa vai para a linha residual "sem closer", que entra no Total.
- SDR: cota → `consorcio_pending_registrations.deal_id` → quem agendou a última reunião conduzida por closer da BU.

**Sobre o rótulo:** "Consórcio Efetivado" descreve fielmente o que a coluna soma. `tipo_registro = 'contratacao'` é exatamente "a Embracon confirmou"; reserva fica de fora por construção. Renomear é seguro. A única ressalva é temporal: é "efetivado **no mês da contratação**", não "efetivado a partir de uma venda deste mês" — a explicação da coluna precisa dizer isso.

Conferência no banco (agosto/2026, `data_contratacao`):

| vendedor | cotas | crédito |
|---|---|---|
| Joao Pedro Martins Vieira | 44 | R$ 7.750.000 |
| André Duarte | 13 | R$ 2.430.000 |

Bate com a tela.

## 2. "Cotas Contratadas" e "Vendas Realizadas" — mesma régua

As três colunas saem do **mesmo hook, mesma query, mesmo filtro e mesma data** (`data_contratacao`). Só muda a agregação:

- **Cotas Contratadas** = contagem de linhas de `consortium_cards` (`byCloser`).
- **Vendas Realizadas** = contagem de **clientes distintos** (`clientesByCloser`), identidade por CPF/CNPJ e fallback no nome normalizado. Um cliente com 3 cotas = 1 venda e 3 cotas.
- **Crédito Contratado** = `sum(valor_credito)`.
- Ticket Médio = crédito ÷ clientes; Conv. Vendas/Reunião = clientes ÷ reuniões realizadas.

Ou seja: hoje o painel tem um único eixo de data. Nada nele fala de proposta ou de termo.

## 3. Como seria "Produção Gerada" pelo termo assinado

Assinatura fica em `consorcio_termos`: `tipo = 'adesao'`, `status = 'assinado'`, data em **`assinado_em`** (timestamptz). O termo é **um por venda** (proposta), grava `proposal_id`, `deal_id` e o `pending_registration_id` só da primeira carta.

Caminho até o valor e até o closer — **não existe atalho**:

```text
consorcio_termos (assinado_em, proposal_id)
  → consorcio_proposals (status, aceite_date, created_by)
      → consorcio_proposal_cartas.valor_credito   (soma = crédito da venda)
  closer: proposals.created_by → profiles.email → closers.email
          fallback: crm_deals.owner_id → closers.email
          fallback: meeting_slot_attendees → meeting_slots.closer_id
```

Esse é exatamente o encadeamento que `useConsorcioRealizadoByCloser.ts` já usa. **Não** use `consorcio_pending_registrations.vendedor_name` como atribuição: os valores reais em produção incluem "Reverter", ".", "Efeito Alavanca + Clube" — o campo está sujo e atribuiria produção a strings que não são pessoas.

## 4. O número real — e é aqui que a hipótese cai

O fluxo de termo eletrônico **começou em 19/08/2026** (`min(assinado_em) = 2026-08-19`, e `DATA_PRIMEIRO_TERMO_ADESAO = '2026-08-19'` em `src/lib/consorcioLiberacaoCadastro.ts`). Toda a base existe há 4 dias.

Crédito das vendas com termo de adesão assinado em agosto/2026, por closer (via `created_by` da proposta):

| closer | vendas com termo assinado | crédito |
|---|---|---|
| André Duarte | 2 | R$ 600.000 |
| João Pedro | 1 | R$ 960.000 |
| (proposta criada por Grimaldo, deal do João Pedro) | 1 | R$ 500.000 |
| **Total** | **4** | **R$ 2.060.000** |

Contra a tela de hoje: João Pedro R$ 7.750.000 e André R$ 2.430.000 (total R$ 10.180.000).

Ampliando o critério para "proposta aceita em agosto" (sem exigir termo), ainda dá pouco: João Pedro R$ 2.290.000 e André R$ 1.200.000 — R$ 3.490.000. E a etapa 4 inteira, hoje, em toda a base: 30 cadastros em `aguardando_abertura`, R$ 4.150.000.

Motivo: as 57 cotas contratadas de agosto **não nasceram do fluxo de proposta**. Dos 91 cadastros criados em agosto com crédito (R$ 15.450.000), a maioria vem de carga/cadastro direto, sem proposta e sem termo. Então "Produção Gerada" medida por termo assinado sairia **cinco vezes menor** que "Consórcio Efetivado" — e o painel viraria uma denúncia de subnotificação, não uma métrica de produção.

## 5. A data de referência — o risco que você apontou, confirmado e ampliado

Lado a lado, com "Produção Gerada" por `assinado_em` e "Consórcio Efetivado" por `data_contratacao`:

- As duas colunas **nunca fecham entre si dentro do mês**, e isso é correto: são dois momentos diferentes da mesma venda. Assinada em julho, contratada em agosto → aparece só na segunda.
- Pior no seu caso concreto: em agosto a produção (R$ 2,06 M) fica **abaixo** do efetivado (R$ 10,18 M), o que é contraintuitivo — "gerei menos do que efetivei". Enquanto a base histórica não tiver termo, essa inversão é permanente e vai ser lida como bug.
- Mitigação obrigatória na tela: as duas colunas precisam de tooltip explicitando a âncora ("assinatura do termo" vs. "confirmação da Embracon"), e a coluna nova precisa de nota de cobertura — "considera apenas vendas com termo eletrônico, disponível desde 19/08/2026". Sem essa nota, a primeira segunda-feira gera o ticket.

## 6. Impacto em Ticket Médio, Conv. Vendas/Reunião e Total

- **Ticket Médio** e **Conv. Vendas/Reunião** derivam de `clientes` e `credito` **do bloco contratado**. Como a coluna nova é aditiva e não substitui `creditoByCloser`, **nada quebra** — desde que a nova coluna não seja plugada nesses divisores.
- **Total**: só fecha se a coluna nova tiver a mesma disciplina de residual que a atual (`creditoSemCloser`). Produção com closer não resolvido precisa de linha "Não atribuído", senão a soma das linhas fica menor que o Total e o painel se contradiz.
- Ordem pedida (entre *Vendas Realizadas* e *Cotas Contratadas*) coloca dinheiro no meio de duas contagens; funciona, mas fica menos legível que colocar produção **antes** de Vendas Realizadas.

## Sobre as cartas com crédito somado

O alerta procede e limita o desenho: cartas em `consorcio_proposal_cartas` que carregam a soma de várias cotas (5 × 120k gravadas como uma carta de 600k).

- Para **somar crédito** (é o que "Produção Gerada" faz): não distorce. `sum(valor_credito)` dá o mesmo total.
- Para **contar cartas**: distorce, e por isso a coluna nova **não deve exibir contagem de cartas** nem alimentar ticket médio de produção. Se um dia mostrar "N cartas geradas", o número estará errado por construção.
- Confirmação no banco: das 4 propostas com termo assinado, uma tem 3 cartas e as outras 1 — e a soma das cartas bate com o agregado `consorcio_proposals.valor_credito` em todas. O agregado serve de conferência, não de fonte.

## Recomendação

**Renomear "Crédito Contratado" → "Consórcio Efetivado": aprovado, o rótulo é fiel.** Só acrescente ao tooltip que a âncora é a data de contratação.

**"Produção Gerada" a partir de Cotas a Fazer / termo assinado: não agora.** O raciocínio do dono está certo conceitualmente — a assinatura é o marco em que o closer cumpriu a parte dele — mas a base tem 4 dias e cobre 20% do volume. A coluna entraria mostrando um número menor que o efetivado.

Etapa que eu defendo no lugar, se o dono quiser a coluna já nesta rodada:

- **Âncora: `consorcio_proposals.aceite_date` com `status = 'aceita'`** (proposta aceita = venda gerada), somando `consorcio_proposal_cartas.valor_credito`, atribuição pelo encadeamento do item 3. Cobre mais que o termo (R$ 3,49 M em agosto), tem data de negócio limpa e não depende do fluxo novo. Mesmo assim continua abaixo do efetivado.
- **Ou** manter a intenção do dono e entregar a coluna com **selo de cobertura parcial** visível no cabeçalho, aceitando conscientemente que agosto e setembro serão meses de transição.

O que eu preciso que você decida antes de qualquer código:

1. Âncora da coluna nova: `assinado_em` do termo (fiel à ideia, cobertura de 4 dias) ou `aceite_date` da proposta (cobertura maior, marco um passo antes da assinatura)?
2. A coluna deve incluir vendas que **já** efetivaram no mesmo mês (produção total gerada) ou só as ainda não efetivadas (pipeline)? O primeiro é comparável mês a mês; o segundo muda de valor sozinho conforme a Embracon confirma.
