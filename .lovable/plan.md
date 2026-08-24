# Produção Gerada: 55 vs 50 registros — diagnóstico e opções de conserto

## Resposta curta

Não falta registro nenhum na lista. É **a mesma coleção contada em duas unidades diferentes**:

- o card conta **cartas** (e chama de "registros");
- a lista do Faturamento conta **linhas de registro** (1 por proposta, 1 por cadastro avulso, 1 por cota legada).

A proposta com N cartas soma N no card e aparece como **uma** linha na lista (com o sufixo "· N cartas"). Em agosto/2026 há 5 cartas excedentes, e é exatamente o delta 55 − 50.

## 1. De onde sai cada número

| Onde | Arquivo:linha | Expressão |
|---|---|---|
| Card "Produção Gerada" (`24 vendas · 55 registros`) | `src/pages/bu-consorcio/CloserDetalheConsorcio.tsx:437` | `` `${linhaProducao?.vendas} vendas · ${linhaProducao?.cartas} registros` `` |
| Bloco Faturamento (`50 registros`) | `src/pages/bu-consorcio/CloserDetalheConsorcio.tsx:227` | `` `${itens.length} registros` `` |

Ambos vêm do mesmo hook, `src/hooks/useConsorcioProducaoGerada.ts`:

- `linha.cartas` é incrementado em `add(...)`: perna A soma `agg.qtd` (quantidade de cartas da proposta, linha 392/409), perna B soma 1 por cadastro (533/555), perna C soma 1 por cota (658/674).
- `itensByCloser` recebe **um item por proposta** na perna A (`addItem`, 393, com `cartas: agg.qtd` dentro do item), um por cadastro (538) e um por cota (661).

Logo: `cartas = itens.length + (cartas excedentes das propostas multi-carta)`.

## 2. Qual está certo

Os dois estão certos para o que medem, e **nenhum registro está escondido**. Os R$ 10.150.000 são compostos por **50 registros**, dos quais 7 são propostas (perna A) que carregam 12 cartas — 5 a mais que 7.

Conferido em agosto/2026 (propostas `aceita`, não excluídas, âncora `aceite_date`/`proposal_date` no mês): **7 propostas · 12 cartas · 2 propostas multi-carta**, excedente = **5**. Fecha o delta na unha.

## 3. Os 5 "registros" que não têm linha própria

Não são registros ausentes: são cartas adicionais dentro de duas propostas que já aparecem na lista.

| Cliente (deal) | Âncora | Cartas | Crédito | Cartas excedentes | Origem |
|---|---|---|---|---|---|
| Daniel Alves Martins — EFEITO ALAVANCA | 2026-08-22 | 4 (150k ×4) | R$ 600.000 | 3 | Perna A (proposta) |
| Victor Humberto Defanti Petrazzini | 2026-08-22 | 3 (150k, 150k, 200k) | R$ 500.000 | 2 | Perna A (proposta) |

As outras 5 propostas de agosto têm 1 carta cada (Nelson 300k, Marcos Felipe 300k, Paulo Sergio 600k, "Consórcio imóvel e automóvel" 230k, Fernando Paranaiba 960k).

## 4. As "24 vendas"

É um **terceiro eixo**, e hoje sem rótulo que diga isso. Em `useConsorcioProducaoGerada.ts`:

- perna A: `+1 por proposta aceita` (linha 392/410) — a unidade é a proposta, não a pessoa;
- perna B: `+1 por CLIENTE distinto` (`clientePessoaKey`, CPF/CNPJ → nome; linhas 527–564);
- perna C: `+1 por CLIENTE distinto` das cotas legadas (654–680).

Consequências honestas: (a) mistura unidades (proposta na A, pessoa na B/C); (b) a mesma pessoa com proposta na A e cadastro avulso na B pode contar duas vezes; (c) não conversa 1:1 nem com 50 nem com 55 por construção. É diferente das "18 vendas" do card Vendas Realizadas, que é pessoa distinta com cota contratada.

## Duas opções de conserto (escolha sua)

### Opção 1 — Alinhar as contagens (uma unidade só na tela)

O card passa a mostrar o mesmo número da lista (`itens.length`, 50) e a palavra "cartas" volta para onde é cartas: `50 registros · 55 cartas`. A lista já mostra "· N cartas" por linha, então bate por inspeção.

- Custo: mexe no rótulo/valor do card de um closer e do bloco; a coluna **Produção Gerada do Painel Comercial** (`ConsorcioCloserSummaryTable` / `ConsorcioSdrSummaryTable`) usa `cartas` no mesmo sentido de "registros" — para não criar uma terceira divergência, o painel precisa do mesmo tratamento na mesma rodada.
- Risco: números que a diretoria já viu ("55") mudam de significado visível. Nenhum valor em R$ muda.

### Opção 2 — Manter os números e rotular cada um pelo que é

Card: `24 vendas · 55 cartas`. Bloco Faturamento: `50 registros (55 cartas)`. E o rótulo "vendas" no card de Produção Gerada ganha tooltip dizendo que ali a unidade é proposta na perna A e cliente nas pernas B/C — portanto não é comparável com as "18 vendas" de Vendas Realizadas.

- Custo: só texto e tooltip; nada de lógica, nada de painel obrigatório na mesma rodada.
- Risco: continuam três eixos na tela; a confiança depende do closer ler o rótulo.

### Recomendação (não aplicada sem seu ok)

Opção 2 agora (barata, tira a contradição aparente hoje) e, se você quiser um eixo único de auditoria, Opção 1 depois, junto do painel — nas duas telas ao mesmo tempo.

### Item separado, decidir junto

"Vendas" da Produção Gerada pode contar a mesma pessoa duas vezes (proposta na A + cadastro na B). Consertar isso é mudar a métrica (dedup por pessoa nas três pernas), não rótulo. Digo apenas que existe; não entra sem sua ordem.

## Regra desta rodada

Nada de código e nada de dado tocado — só leitura de arquivos e consultas SELECT.
