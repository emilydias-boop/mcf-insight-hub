# BLOCO D — desenho: escolher o plano no "Lançar Venda"

Rodada de desenho. Nada de código, nada de migration. Abaixo as cinco respostas.

## 0. Um fato que muda o desenho

A **condição de pagamento já existe na carta hoje** (`condicaoPagamento` no bloco "Plano da carta" de `CartasProposalEditor`, gravado em `consorcio_proposal_cartas.condicao_pagamento`). Ela não é um campo novo — é um campo existente que quase ninguém preenche: **10 de 177 cartas** têm condição gravada. As outras 167 caem em `convencional` por normalização silenciosa. Foi isso que fez o dono não achar o 508,92: não faltava campo, faltava a condição ter sido escolhida.

Prazo: 175 de 177 em 200/220/240; 2 fora.

## 1. Onde o seletor entra e o que acontece com o crédito digitado

**Proposta: o crédito deixa de ser digitado no caminho comum e passa a vir do plano — mas o campo não desaparece.**

O bloco da carta fica assim, na ordem em que a decisão acontece:

```text
Carta 1
  Tipo de produto  [Parcelinha ▾]     Prazo [240 ▾]     Condição [Convencional ▾]
  Plano            [ R$ 150.000 — parcela R$ 2.293,75 / R$ 1.026,40  ▾ ]
                   (lista filtrada por produto + prazo + condição)
  Crédito  R$ 150.000,00   Parcela 1ª–12ª  R$ 2.293,75   Demais  R$ 1.026,40
                   ↑ preenchidos pelo plano, somente leitura, com "editar manualmente"
```

Por quê assim e não "o crédito some":

- O crédito é o número que o closer negocia e fala com o cliente. Ele tem que ficar visível na carta, não escondido dentro do rótulo de um select.
- 33 cartas históricas não têm plano correspondente. Se o crédito só existir como consequência do plano, essas vendas não podem nascer. O campo tem que continuar existindo como saída.
- `EditProposalModal` reabre cartas antigas com crédito que talvez não case com nenhum plano ativo. Campo derivado puro faria a carta abrir vazia — perda de dado na cara do usuário.

Então: **crédito e as duas parcelas ficam preenchidos e travados enquanto houver plano escolhido**, com um botão discreto "editar manualmente" que destrava os três e marca a carta como manual. Escolher um plano de novo volta a travar e sobrescreve.

## 2. Ordem de preenchimento

Ordem proposta: **Tipo de produto → Prazo → Condição → Plano**. Os três primeiros são o filtro; o Plano só habilita quando os três existem, com texto cinza dizendo exatamente o que falta ("escolha o prazo para ver os planos"), no mesmo padrão que já usamos em `DadosPlanoFields`.

Sobre trazer a condição: **não é campo novo, é subir um campo que já está ali para cima e torná-lo obrigatório no caminho do plano.** Custo real:

- Baixo na tela: um select que já existe muda de lugar e de peso.
- O custo verdadeiro é de processo: hoje 94% das cartas não declaram condição e o sistema assume `convencional`. Tornar isso explícito vai expor divergências reais entre o que foi vendido e o que estava sendo assumido. Isso é ganho, não regressão — mas é conversa com a equipe, não só código.
- Defaults: pré-selecionar `Convencional` mantém o caso comum em um clique zero. **Prazo 240 e Parcelinha também vêm pré-selecionados** (175/177), então o caso comum é: abre a carta, escolhe o plano, pronto.

## 3. A saída obrigatória — "meu plano não está na lista"

A venda **nunca** para. Desenho:

1. No fim da lista de planos, uma opção fixa: **"Meu plano não está na lista — informar manualmente"**.
2. Escolhendo isso, crédito e parcelas destravam e voltam a ser digitados exatamente como hoje. Nada muda no salvamento.
3. A carta ganha um selo âmbar **"plano fora da tabela"** e um campo opcional de observação de uma linha ("240x sem tabela", "crédito novo da Embracon").
4. Quando a lista está filtrada mas vazia, a tela diz o motivo em cinza — "nenhum plano cadastrado para Parcelinha · 240 · Convencional" — e oferece a mesma saída, sem vermelho.

Como a equipe de cadastro fica sabendo: usar o que já existe em vez de inventar canal novo.

- A carta manual entra no **Dossiê do cadastro** e no bloco de pendências da etapa 4 com a linha "plano fora da tabela — cadastrar plano".
- A tela **Planos** (que já mostra `N/9 combinações`) ganha uma faixa no topo: "N cartas lançadas sem plano correspondente", com a lista de combinações pedidas (produto · crédito · prazo · condição) e quantas cartas cada uma representa. Quem tem o papel `cobranca_consorcio` cadastra a partir dali.
- Nada disso bloqueia termo, cadastro ou comissão. É informação, não trava.

## 4. O que muda no que é gravado — nada de formato

Confirmo: dá para fazer sem tocar no formato, pelo mesmo caminho da migração do `CurrencyInput`.

- O plano devolve `number`. Ele passa por `numberToBRLInput()` — a mesma função que `cartasParaDrafts` já usa para hidratar `valorStr`, `parcela1a12Str` e `parcelaDemaisStr` a partir do banco.
- Ou seja: escolher o plano produz **a string idêntica** à que a hidratação produziria para aquele mesmo número. `draftsParaInput` continua desmascarando com o mesmo `replace(/\D/g,'')/100`.
- Consequência para o `formDiff`: escolher um plano cujos valores são iguais aos gravados gera **zero diff** — o comportamento correto. Só um plano diferente produz diff, e só nos três campos que mudaram.
- Colunas gravadas seguem as mesmas: `valor_credito`, `parcela_1a_12a`, `parcela_demais`, `condicao_pagamento`, `prazo_meses`, `tipo_produto`. Nenhum campo novo é obrigatório no banco para a Fase 1.

## 5. Risco, e onde eu dividiria

É a tela onde a venda nasce, e ela é usada por três modais (`ProposalModal`, `AddCartaModal`, `EditProposalModal`). O que pode dar errado:

| Risco | Redução |
|---|---|
| Carta antiga abre no `EditProposalModal`, nenhum plano casa, campos abrem vazios | Hidratação nunca depende de plano: carta existente abre **em modo manual** com os valores do banco. Plano é opt-in ao clicar. |
| Trocar produto/prazo/condição limpa crédito e parcelas de uma carta já preenchida | Mudança de filtro **não apaga nada**; só reduz a lista. Sobrescrever exige escolher um plano. |
| "×N Duplicar" copiando plano parcialmente | O duplicar copia os mesmos campos de hoje (strings) — plano escolhido não é estado extra a copiar se derivarmos o selecionado dos valores. |
| Fase 4 (Cotas a Fazer) já grava parcela; conflito de fonte | Fase 1 não encosta na etapa 4. A etapa 5 segue sendo a verdade oficial. |
| Regressão silenciosa no `formDiff` | `numberToBRLInput` como único caminho de formatação, e um teste manual: abrir carta, salvar sem tocar → diff vazio. |

**Divisão que eu recomendo — duas fases, e não fazer tudo agora:**

- **Fase D1 (baixo risco, entrega o valor da ideia):** subir a condição, pré-selecionar produto/prazo/condição, seletor de plano com preenchimento dos três campos, saída manual, selo "plano fora da tabela". Só `CartasProposalEditor` e um hook de leitura. Sem migration.
- **Fase D2 (depois, separada):** a faixa de "planos faltando" na tela Planos e a pendência no Dossiê/etapa 4. Toca outras telas e pode virar migration se quisermos registrar o pedido de plano como dado, não como derivação.

O pedaço que eu **não** faria nesta rodada: tornar o plano obrigatório, ou usar o plano para recalcular cartas já lançadas. REGRA ZERO — nada gravado é alterado.

---

Nenhuma linha de código foi escrita. Aguardo a autorização do dono, e de preferência só da Fase D1 primeiro.
