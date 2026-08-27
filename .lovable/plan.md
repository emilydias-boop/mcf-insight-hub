# Mapa: parcela por produto (Select × Parcelinha) no lançamento da venda

Somente leitura. Nada foi alterado.

## 1) O editor de cartas — `src/components/consorcio/CartasProposalEditor.tsx`

Estrutura de cada "Carta N":

- Filtro do plano (linha de 3 campos), `:326-398`: **Tipo de produto** (`c.tipoProduto`, `:328-341`), **Prazo** e **Condição de pagamento**. Trocar qualquer um só refiltra, nunca reseta valores.
- Seletor **"Escolher plano da tabela"** `:417-442`, com saída de emergência `__manual__` no topo (`:433`) e rótulo de cada opção em `:437-440`:
  `{crédito} — 1ª à 12ª {parcela1a12} · demais {parcelaDemais} ({produtoCodigo})`.
- Trio de valores `:474-513`: **Crédito (R$)** (`c.valorStr`), e os dois campos de parcela:

```tsx
// :492-500
<Label className="text-xs">Parcela 1ª à 12ª (R$)</Label>
<CurrencyInput
  value={c.parcela1a12Str}
  onChange={masked => patch(c.key, { parcela1a12Str: masked })}
  disabled={!manual}
/>
// :503-510
<Label className="text-xs">Demais parcelas (R$)</Label>
<CurrencyInput
  value={c.parcelaDemaisStr}
  onChange={masked => patch(c.key, { parcelaDemaisStr: masked })}
  disabled={!manual}
/>
```

- Aviso inline `:409-413`: `sem parcela → cadastro incompleto`.
- Estado por carta é `PropostaCartaDraft` (`src/types/consorcioCartas.ts:44-62`): `tipoProduto`, `prazoMeses`, `condicaoPagamento`, `valorStr`, `parcela1a12Str`, `parcelaDemaisStr`, `parcelasMcf`, `categoria`, `objetivo`. Gravação em `draftsParaInput` (`:112-128`) → `parcela_1a_12a`, `parcela_demais`.
- `tipoProduto` entra também como **filtro do plano** em `filtrarPlanosCarta` (`src/hooks/useConsorcioPlanosCarta.ts:103-156`) e há pré-seleção de Parcelinha como padrão (`CartasProposalEditor.tsx:136-137`).

## 2) Valores de `tipo_produto`

Lista vem da tabela `consorcio_tipo_produto_options` (hook `useConsorcioTipoOptions`), passada como `tipoOptions` pelos modais (`ProposalModal.tsx:56,167`; `AddCartaModal.tsx:257,751`). Linhas atuais:

| name | label |
| --- | --- |
| `parcelinha` | Parcelinha |
| `select` | Select |

Gravado em `consorcio_proposal_cartas`:

| tipo_produto | cartas | com `parcela_1a_12a` | com `parcela_demais` |
| --- | --- | --- | --- |
| `parcelinha` | 197 | 33 | 33 |
| `select` | 2 | 0 | 0 |

A tradução produto → estrutura de taxa é única e já existe: `src/lib/consorcioParcelaOficial.ts:44-48` — `'select' → 'primeira_parcela'`, qualquer outro → `'dividida_12'`.

## 3) Onde a parcela mora no banco

Mesmo par de colunas em três tabelas (nomes reais):

- `consorcio_proposal_cartas.parcela_1a_12a`, `.parcela_demais` (+ `parcelas_mcf`)
- `consorcio_pending_registrations.parcela_1a_12a`, `.parcela_demais` (+ `parcelas_pagas_empresa`, `empresa_paga_parcelas`, `inicio_segunda_parcela`, `parcela_inicial_paga_em/por`)
- `consortium_cards.parcela_1a_12a`, `.parcela_demais` (+ `parcelas_pagas_empresa`)
- `consortium_installments.numero_parcela`, `.valor_parcela` (cronograma, valor por parcela)
- Tabela oficial `consorcio_creditos`: 18 colunas `parcela_1a_12a_{conv|50|25}_{200|220|240}` e `parcela_demais_{...}`

Ou seja: o nome "1a_12a" está cravado em 3 tabelas de operação + 18 colunas da tabela oficial.

## 4) Caminho até o termo — `src/lib/consorcioTermo.ts`

- Placeholders declarados `:22-23`: `{ key: 'parcela_1a_12a', label: 'Parcela 1ª à 12ª' }`, `{ key: 'parcela_demais', label: 'Demais parcelas' }`.
- Montagem dos valores `:197-198`: `parcela_1a_12a: formatCurrency(...)`, `parcela_demais: formatCurrency(...)`.
- Multi-carta: tabela markdown `:283-288` com cabeçalho `| Carta | Produto | Crédito | Prazo | Parcela 1ª–12ª | Demais |`, e agregado `:359-364`.
- **Regra de valor por parcela, hardcoded em 12** — `:98-104` (`parcelasMcfComValoresDigitados`): `valor: p.numero <= 12 ? p12 : pDemais`. Mesma regra em `src/lib/consorcioParcelasEmpresa.ts:24-39`.
- Bloqueio de emissão `:166-167` e `:247-248`: exige `parcela_1a_12a` e `parcela_demais` preenchidos.

Modelo ativo `tipo='adesao'` (`Termo de Adesão — Consórcio Embracon`, id `f3421c82-…`), linhas com parcela:

```
**Valor da parcela (1ª à 12ª):** {{parcela_1a_12a}}
**Valor das demais parcelas:** {{parcela_demais}}
3. Está ciente de que **as parcelas não cobertas pelo compromisso da MCF Capital são de sua inteira responsabilidade**, ...
```

O modelo `comprovante_cadastro` ativo (id `7a344df1-…`) não imprime os dois valores; usa `{{cronograma_qtd}}`, `{{parcelas_mcf_qtd}}`, `{{parcelas_mcf_total}}`, `{{parcelas_cliente_qtd}}`.

## 5) O "Plano da carta — Escolher plano da tabela"

Tabela = `consorcio_creditos` (planos por crédito) cruzada com `consorcio_produtos`. Query única em `useConsorcioPlanosTabela`; filtro em memória em `filtrarPlanosCarta` (`useConsorcioPlanosCarta.ts:103-156`).

Colunas de parcela: as 18 acima (`parcela_1a_12a_*` / `parcela_demais_*` por condição e prazo, prazos 200/220/240).

**Ela distingue Select de Parcelinha — mas não pelo nome da coluna.** A distinção está em `consorcio_produtos.taxa_antecipada_tipo`, e o filtro já usa isso (`:123-128`, via `taxaAntecipadaTipoDeProduto`):

| taxa_antecipada_tipo | produtos (codigo) |
| --- | --- |
| `primeira_parcela` (Select) | EI1, PSE, SEP, SEP_ALTO |
| `dividida_12` (Parcelinha) | TEP, TEP_ALTO, TP, TPA |

Ou seja, para o plano escolhido na tabela **o sistema já sabe a estrutura** e não precisa perguntar: `valorParcelaOficial` (`consorcioParcelaOficial.ts:228-233`) já lê `primeira_parcela` como "1ª diferente, resto igual". A coluna `parcela_1a_12a`, para Select, é na prática "parcela 1ª"; `parcela_demais` é "2ª em diante". O que está errado é só o **rótulo** (e os pontos que hardcodam `<= 12`).

## 6) Aviso "sem parcela → cadastro incompleto"

Dois cálculos, mesma regra:

- Tela: `cartaSemParcela` (`src/types/consorcioCartas.ts:96-98`) — só exige `parcela1a12Str > 0`; renderizado em `CartasProposalEditor.tsx:409`.
- Cadastro: `camposCadastroFaltantes` (`src/lib/consorcioCadastroIncompleto.ts:38-42`) — exige `parcela_1a_12a`, `categoria`, `origem` (mais os campos de pessoa) e o par completo no termo (`consorcioTermo.ts:166-167,247-248`).

## 7) Raio de impacto — quem lê `parcela_1a_12a` / `parcela_demais`

Escrita/propagação: `useConsorcioPostMeeting.ts` (:557-572, :760-788, :1253-1391 — carta → cadastro → cota, com diff de auditoria), `AcceptProposalModal.tsx` (:31-97,:173), `ProposalModal.tsx:108-109`, `EditProposalModal.tsx:70-71`, `AddCartaModal.tsx`, `useConsorcioPendingRegistrations.ts` (:65-109, :320-321, :425-426, :983-1146 — inclui abertura de cota), `supabase/functions/webhook-consorcio/index.ts:112-113,335-336`.

Leitura/derivação: `consorcioTermo.ts`, `consorcioParcelasEmpresa.ts` (cronograma MCF), `consorcioComprovante.ts`, `consorcioParcelaOficial.ts`, `consorcioCalculos.ts`, `useConsorcio.ts:45`, `useContemplacao.ts:14`, `useLeadReport.ts` (:130-131,:205-206,:260-317,:702-762), `RelatorioLead.tsx:523-524,651-652`, `ConsorcioCardForm.tsx:731-765`, `PlanosTab.tsx` (cadastro da tabela oficial), `DadosPlanoFields.tsx:118-119,432-446`, `useConsorcioPlanosFaltando.ts:113,209`, `ParcelaComposicao.tsx`, `DossieCadastroDialog.tsx`, `GerarComprovanteModal.tsx`, `OpenCotaModal.tsx`, `CotaCadastradaModal.tsx`.

Leitura do mapa: **renomear coluna toca 3 tabelas de operação, 18 colunas da tabela oficial, 1 edge function e ~25 arquivos**. Reinterpretar por produto toca os rótulos de tela e os poucos pontos que hardcodam a faixa de 12 (`consorcioTermo.ts:98-104`, `consorcioParcelasEmpresa.ts:38-39`, `ConsorcioCardForm.tsx:737-742`), reaproveitando `taxaAntecipadaTipoDeProduto` e `valorParcelaOficial`, que já existem.

## 8) Histórico — mudar a interpretação quebra documento emitido?

`consorcio_proposal_cartas`: 2 cartas `select`, **ambas sem parcela gravada** (0 de 2 em cada coluna). Parcelinha: 197 cartas, 33 com parcela.

`consorcio_pending_registrations`: 33 `select` com `parcela_1a_12a` = **0**; 389 `parcelinha` com 45 preenchidas; 41 sem tipo, todas vazias.

`consortium_cards`: 258 `select`, **todas as 258 com os dois valores preenchidos** (carga da base de cotas), e 1 523 de 1 549 `parcelinha`.

Consequência: **nenhuma carta ou cadastro Select tem valor de parcela gravado hoje** — logo nenhum termo de adesão Select foi emitido a partir dessas colunas, e reinterpretar não reescreve documento nenhum. O risco fica em `consortium_cards` Select (258 linhas), lidas por cronograma/comprovante/relatórios: hoje elas são exibidas como "1ª à 12ª", e a reinterpretação mudaria o cronograma derivado dessas cotas (não o dado, apenas a leitura). Termo já emitido segue snapshot e intocado.

## Perguntas abertas para a próxima rodada

1. Nas 258 cotas Select de `consortium_cards`, o valor em `parcela_1a_12a` é o da **1ª parcela** (leitura Select) ou foi carregado como faixa de 12? Isso decide se a reinterpretação é neutra ou precisa de conferência caso a caso.
2. O rótulo deve mudar por `tipo_produto` escolhido na carta, ou derivar do `taxa_antecipada_tipo` do produto do plano da tabela (mais preciso, mas só existe quando o plano vem da tabela)?
