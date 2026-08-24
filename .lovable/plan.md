# Produção Gerada — ponte 13.520.000 → 14.680.000, prova do dedup e tamanho da perna C

Rodada de medição. Nenhum código, nenhuma migração, nenhum dado tocado.

## 1. A ponte, linha a linha

```text
13.520.000   Produção Gerada publicada hoje (A 3.490.000 + B_antiga 10.030.000)
  − 150.000   1 cota — caminho 4 reconheceu o vínculo com proposta (dedup)
  − 120.000   1 cadastro — aceite_date de julho, sai de agosto (deslocamento de mês)
+1.190.000   11 cadastros de etapa 4 órfã (sem cota aberta) entram
  + 240.000   2 cadastros de etapa 5 órfã (cota em reserva) entram
14.680.000   Produção Gerada nova (A 3.490.000 + B_nova 11.190.000 + C 0)
```

Fechamento da perna B nova, medido: 9.760.000 (54 cotas contratadas de agosto, agora
contadas pelo cadastro) + 1.190.000 (etapa 4) + 240.000 (etapa 5) = **11.190.000**.
Para essas 54, o crédito do cadastro e o crédito da cota são **idênticos** (9.760.000 nos
dois lados) — a troca de unidade não mexeu em valor nenhum.

## 2. De onde vinham os R$ 620.000 que faltavam

Sua aritmética estava certa; os números da rodada anterior é que tinham âncora diferente.

- **R$ 500.000 — 1 cadastro (Rodrigo Costa, status `declinada`), aceite 03/07, lançado 03/08.**
  Na rodada anterior a etapa 4 órfã foi medida por `created_at` (12 registros, R$ 1.690.000).
  Com a âncora aprovada (`aceite_date`), ele conta em **julho**, não em agosto: 11 registros,
  R$ 1.190.000. É exatamente o caso de antedatação que eu citei — e é o item 2 abaixo.
- **R$ 120.000 — 1 cadastro (Sirleia Aparecida Vieira), aceite 09/07, lançado 06/08, cota
  contratada 11/08.** Esse é o deslocamento de mês real. Eu havia rotulado errado: o registro
  de R$ 150.000 que você subtraiu como deslocamento é o do item 3 (dedup), não deslocamento.

500.000 + 120.000 = **620.000**. Nada sobra fora dos itens 1 a 4.

## 3. O que saiu pelo caminho 4 — sua hipótese está certa, com uma correção

- **1 cadastro, R$ 150.000** (Nelson Alves de Oliveira), cota contratada em 19/08.
- Proposta: `8d0f3213-1ecc-40d2-8907-9dbe47e57de4`, `status = aceita`, `deleted_at` nulo,
  `carta_excluida = false`, âncora `aceite_date = 14/08` — **dentro de agosto**.
- Essa proposta tem **1 carta de R$ 300.000** e **2 cadastros de R$ 150.000** apontando para ela.

A correção à sua leitura: o crédito não "passou a ser representado" pela perna A — ele **já
estava** na perna A. No número publicado ele aparecia duas vezes: R$ 300.000 na carta (perna A)
e mais R$ 150.000 na cota (perna B antiga). O caminho 4 não moveu dinheiro, **removeu uma dupla
contagem**. É dedup funcionando, e o número velho estava R$ 150.000 inflado.

## 4. Prova nos dois sentidos — zero real desaparecido

- **B → A:** o único real que saiu da perna B pelo caminho 4 são os R$ 150.000 acima, e a carta
  de R$ 300.000 da proposta correspondente está na perna A de agosto (âncora 14/08, aceita, não
  excluída, não apagada). A carta cobre os dois cadastros de R$ 150.000 da mesma venda.
- **A → B:** a perna A não foi tocada nesta rodada — soma R$ 3.490.000 antes e depois, mesmo
  código, mesmo filtro. Nenhuma carta saiu de A, então não existe crédito que tenha saído de
  uma perna sem entrar na outra.
- Não há nenhum outro cadastro de agosto excluído pelo caminho 4. Os demais registros com
  `proposal_id` de agosto já estavam fora da perna B antiga pelos caminhos 1 a 3.
- Os 3 cadastros com `consortium_card_id` inexistente: nenhum deles cai em agosto
  (0 registros na perna B de agosto por FK quebrada), e o comportamento é o descrito — o
  cadastro conta, a cota não existe para contar.

## 5. Sinalizador de antedatação — você está certo, ele não protege nada hoje

Confirmado pelo dado: o único caso de agosto (Rodrigo Costa, R$ 500.000, aceite 03/07, lançado
03/08) acende em **julho**, mês já fechado. Quem abre agosto não vê nada.

Opções, sem escolha da minha parte:

**(a) Conta na âncora (julho), mas o aviso aparece também no mês do lançamento (agosto).**
Prós: quem está no mês corrente vê o que foi feito ali; a soma não muda. Contras: o mesmo
registro aparece em dois meses com papéis diferentes — quem lê rápido acha que foi contado duas
vezes; exige texto claro separando "contado aqui" de "lançado aqui".

**(b) Contador separado "lançamentos retroativos feitos neste mês", fora da soma.**
Prós: não encosta na coluna nem na soma; é o mais fácil de explicar. Contras: é mais um número
na tela; ninguém olha um contador que fica quieto — precisa de destaque para funcionar.

**(c) Só o mês do aceite (o que está hoje).**
Prós: uma única âncora, uma única verdade; nenhum risco de leitura dupla. Contras: é auditoria,
não vigilância — só serve para quem volta em mês fechado.

**(d) Aviso no momento do lançamento**, na própria tela de aceite/venda, quando o `aceite_date`
cai em mês anterior ao corrente. Prós: age antes do dado virar histórico, é onde a pessoa pode
corrigir. Contras: não deixa rastro agregado nenhum para a liderança; some depois de salvo.

**(e) Relatório/aba de auditoria de retroativos**, filtrável por mês de lançamento, listando
cadastro, closer, aceite, lançamento e crédito. Prós: rastro permanente, serve para revisão de
fechamento; independe de qual mês está aberto na tela. Contras: é uma tela nova, e só ajuda
quem decide entrar nela.

**(f) Janela de tolerância declarada** (por exemplo, aceite retroativo até o dia N do mês
seguinte é normal; além disso sinaliza). Prós: reduz o ruído dos casos legítimos e faz o aviso
significar algo. Contras: é uma regra de negócio nova, precisa de decisão do dono sobre o prazo.

Nenhuma delas é excludente — (a) ou (b) resolvem a visibilidade no mês corrente, e (e) é o que
dá memória. (f) só faz sentido depois de escolher onde o aviso aparece.

## 6. Perna C no histórico — o processo mudou mesmo

Cotas `contratacao` sem cadastro nenhum e sem proposta, por mês de `data_contratacao`:

```text
2026-01     89 cotas    R$  15.530.000
2026-02    124 cotas    R$  26.770.000
2026-03    189 cotas    R$  33.710.000
2026-04    136 cotas    R$  21.880.000
2026-05     47 cotas    R$  10.500.000
2026-06     89 cotas    R$  14.530.000
2026-07    410 cotas    R$  53.580.000
2026-08      0 cotas    R$           0
```

Acumulado do ano (jan–ago/2026): **1.084 cotas, R$ 176.500.000.**
Base histórica inteira (todos os anos): **1.463 cotas, R$ 303.782.195** — e todos os 1.463 cards
sem cadastro são `tipo_registro = 'contratacao'`, não há resíduo em outros tipos.

Leitura: em agosto **todas** as 56 cotas contratadas órfãs de proposta têm cadastro, então a
perna C zera por mérito do processo, não por filtro. Julho, com 410 cotas, é a última safra
grande de importação/digitação sem cadastro. A consequência prática: qualquer comparação de
Produção Gerada entre agosto e meses anteriores compara duas realidades de origem de dado —
antes de agosto o número é dominado pela perna C, com âncora `data_contratacao`.

## 7. O que eu recomendo decidir antes de publicar

- O número **R$ 14.680.000** está fechado e explicado: cada movimento tem valor, quantidade e
  motivo, e a única saída de dinheiro era dupla contagem.
- Publicar agosto isolado é seguro. Publicar comparação com julho **não é**, pelo motivo do
  item 6 — e isso é conversa de âncora histórica, não de código novo.
