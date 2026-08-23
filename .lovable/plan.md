# Fase D2 — avisar quem cadastra plano, a partir do que já está gravado

Somente leitura. Nenhuma migração, nenhuma coluna nova, nenhum backfill, nenhum UPDATE. Nenhum botão fica `disabled`.

## 1. O que conta como "plano faltando"

Uma carta de `consorcio_proposal_cartas` é **coberta** quando existe uma linha ativa em `consorcio_creditos` tal que:

- o produto casa pela mesma regra que a D1 já usa (`taxaAntecipadaTipoDeProduto(tipo_produto)` contra `consorcio_produtos.taxa_antecipada_tipo`);
- `valor_credito` da carta == `valor_credito` do plano (comparação em centavos arredondados, para não perder por dízima);
- `prazo_meses` ∈ {200, 220, 240};
- as duas colunas daquela condição/prazo (`parcela_1a_12a_<cond>_<prazo>` e `parcela_demais_<cond>_<prazo>`) estão preenchidas (> 0).

Qualquer carta que não satisfaça tudo isso entra na lista como pedido de cadastro.

### Os 167 sem `condicao_pagamento` — como trato

Não assumo `convencional` e não invento condição. Divido em dois grupos com pesos diferentes:

- **Pedido firme** — carta com `condicao_pagamento` preenchida (10 hoje). A combinação é inequívoca: produto · crédito · prazo · condição. Aparece no bloco principal.
- **Pedido provável** — carta sem condição (167 hoje). Verifico se o crédito/prazo existe na tabela em **qualquer** das três condições. Se existe em pelo menos uma, a carta **não** é pedido: a tabela cobre aquele crédito e o que falta é dado da venda, não plano. Se o crédito/prazo não existe em nenhuma condição, é pedido real — listado como "condição não informada", e o cadastro é feito nas três colunas ou na que a Emily/Antony confirmarem.

Isso reduz o ruído no ponto exato que você apontou: dos 33 sem plano exato, só entram os que faltam de fato por crédito/prazo; os 167 não geram 167 linhas de aviso. Agrupamento final por combinação, não por carta — a lista tem ordem de dezenas de linhas, não 177.

Ainda ficam de fora do cálculo: cartas de propostas excluídas/declinadas (`status = 'excluida'` e cartas declinadas), e prazos fora de 200/220/240 aparecem em um contador separado ("prazo sem coluna na tabela — 2 cartas"), porque cadastrar plano não resolve isso; é decisão de estrutura.

## 2. O aviso na tela de Planos

Um bloco recolhível no topo do `PlanosTab`, tom neutro/âmbar, título tipo **"N combinações usadas em vendas sem plano cadastrado"**. Recolhido por padrão se N = 0, aberto com contagem se N > 0. Sem vermelho, sem toast, sem badge de erro.

Cada linha é uma combinação agível:

```text
Parcelinha · R$ 480.000 · 240 · Convencional        6 cartas   [Cadastrar plano]
Parcelinha · R$ 355.000 · 240 · condição não inf.   3 cartas   [Cadastrar plano]
Bem Leve   · R$ 90.000  · 220 · Mais por Menos 50%  1 carta    [Cadastrar plano]
```

Ordenado por número de cartas desc. "Cadastrar plano" só abre o formulário que já existe, pré-preenchido com produto/crédito e o campo de parcela da combinação pedida — o cadastro em si é o fluxo atual, sem atalho novo de escrita. Um "ver cartas" opcional expande os nomes das vendas para conferência.

## 3. A pendência na etapa 4 / Dossiê

Onde entra: no `DossieCadastroDialog`, **abaixo** do bloco "Cadastro incompleto" que já existe, como linha informativa cinza/âmbar clara:

> Plano fora da tabela — Parcelinha · R$ 480.000 · 240. A equipe de cadastro pode cadastrar esse plano em Planos.

Como se distingue do "cadastro incompleto":

| | Cadastro incompleto | Plano fora da tabela |
|---|---|---|
| Sobre o quê | campos do cliente/cota que faltam | a tabela de planos, não a venda |
| Quem age | quem faz o cadastro | quem cadastra plano (`cobranca_consorcio`) |
| Efeito | conta no selo de incompleto | zero efeito: não conta, não bloqueia, não some botão |

Na lista da etapa 4 (`PendingRegistrationsList`) fica no máximo um ícone/tooltip discreto, sem contador próprio e sem entrar em nenhum KPI — para não duplicar o aviso.

## 4. Custo

Uma consulta a mais, agregada em memória e cacheada:

- Um hook novo, `useConsorcioPlanosFaltando`, com `staleTime` de 5 min: lê `consorcio_proposal_cartas` (id, proposal_id, tipo_produto, valor_credito, prazo_meses, condicao_pagamento) de cartas vivas, reaproveita `useConsorcioPlanosTabela` (já cacheada) e monta um `Set` de chaves `tipoTaxa|centavos|prazo|cond` a partir dos 111 créditos — uma passada. Cada carta faz lookup O(1) no Set. Nada de 177 × 111.
- O resultado é um mapa por combinação **e** um mapa `cartaId → combinação faltante`, então o Dossiê não faz consulta nova: consome o mesmo cache.

## 5. Arquivos que eu tocaria

- `src/hooks/useConsorcioPlanosFaltando.ts` (novo, leitura)
- `src/components/consorcio/PlanosTab.tsx` (bloco no topo)
- `src/components/consorcio/DossieCadastroDialog.tsx` (linha informativa)
- `src/components/consorcio/PendingRegistrationsList.tsx` (ícone discreto — opcional, ver corte abaixo)

## 6. Risco

| Risco | Redução |
|---|---|
| Aviso vira ruído por causa dos 167 sem condição | regra do "pedido provável": só entra se o crédito/prazo não existe em nenhuma condição |
| Emily/Antony cadastrarem plano com número chutado para "limpar a lista" | a lista pede combinação, nunca sugere valor de parcela; o valor vem da tabela oficial Embracon |
| Divergência de centavos criando pedidos fantasma | comparação em centavos inteiros; se ainda aparecerem casos de 1 centavo, prefiro deixar a linha aparecer do que casar por tolerância e mentir |
| Duplicação de aviso na etapa 4 | um único lugar com texto ("Plano fora da tabela"), fora do selo de incompleto e fora de qualquer contagem |

## 7. O que eu cortaria

- **A marcação por carta na lista da etapa 4** (`PendingRegistrationsList`). É onde o aviso tem menos chance de ser lido e mais chance de virar poluição. Manteria só no Dossiê.
- **"Ver cartas" expandindo nomes** na tela de Planos: bonito, provavelmente pouco usado. Faria só se a Emily pedir.
- O que eu **manteria a todo custo** é o bloco na tela de Planos: é a única parte que realmente fecha o ciclo da ideia do dono.

Se você quiser um sinal gravado de verdade ("esta carta nasceu no caminho manual"), isso exige **coluna nova** em `consorcio_proposal_cartas` — digo em voz alta e não faço: fora do escopo desta rodada, decisão sua.
