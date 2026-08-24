# Investigação: cadastro de produto AUTO trava em `prazos_disponiveis`

Sua suspeita está certa. O NOT NULL é só o primeiro obstáculo; o formulário e a cadeia de cálculo são **imóvel-only por construção (200/220/240)**.

## A. O que é `prazos_disponiveis`

- Coluna `integer[]` (`udt_name = _int4`), `NOT NULL`, **sem default** — criada assim em `supabase/migrations/20260116142212_...sql:11` (`prazos_disponiveis INTEGER[] NOT NULL`).
- Semântica de uso hoje: é apenas a **lista de prazos que o seletor de prazo oferece** (`src/components/consorcio/DadosPlanoFields.tsx:104-106`). Não entra em nenhum cálculo de parcela.
- Os 7 produtos existentes (todos `ativo = true`), com objetivo e conteúdo da coluna:

| Código | Nome | Objetivo | `prazos_disponiveis` | `prazo_maximo_venda` | adm 200/220/240 | Faixa |
|---|---|---|---|---|---|---|
| TP | Tabela Parcelinha | Imóvel | `{200,220,240}` | null | 20 / 22 / 25 | 120k–600k |
| EI1 | Estendido 1% | Imóvel | `{200,220,240}` | null | 20 / 22 / 25 | 120k–600k |
| PSE | Plano Select Estendido | Imóvel | `{200,220,240}` | null | 20 / 22 / 25 | 120k–600k |
| TEP | Tabela Estendido Prime | Imóvel | `{200,220,240}` | null | 20 / 22 / 25 | 600k–1,2M |
| SEP | Select Estendido Prime | Imóvel | `{200,220,240}` | null | 20 / 22 / 25 | 600k–1,2M |
| TEP_ALTO | TEP Alto Valor | Imóvel | `{200,220,240}` | null | 20 / 22 / 25 | 1,0M–2,0M |
| SEP_ALTO | SEP Alto Valor | Imóvel | `{200,220,240}` | null | 20 / 22 / 25 | 1,0M–2,0M |

**Os 7 têm exatamente o mesmo valor: `{200,220,240}`.** Todos Imóvel. `prazo_maximo_venda` é null em todos os 7 (o campo é mais novo que o seed).

## B. Por que o formulário não manda

- Estado do formulário: `src/components/consorcio/ConsorcioConfigModal.tsx:509-527`. As chaves são `codigo, nome, objetivo_option_id, faixa_credito_min/max, taxa_antecipada_percentual, taxa_antecipada_tipo, taxa_adm_200/220/240, fundo_reserva, seguro_vida_percentual, prazo_maximo_venda, comissao_base, comissao_schedule`. **`prazos_disponiveis` não existe no estado.**
- `submit()` (linhas 559-568) faz `onSave({ ...form, comissao_schedule })` — ou seja, manda literalmente o `form`, nada mais.
- `useCreateConsorcioProduto` (`src/hooks/useConsorcioProdutos.ts:62-72`) faz `insert(input as any)` sem completar nada.
- Logo: **a coluna não está no payload**. Postgres tenta o default, não há default, e o NOT NULL estoura. Não é "vai null explícito" — é ausência.
- Detalhe: na **leitura** o código já mascara isso com `item.prazos_disponiveis || [200, 220, 240]` (`useConsorcioProdutos.ts:20`) e `consorcioParcelaOficial.ts:104` — por isso ninguém percebeu a lacuna antes.

## C. Outras colunas NOT NULL sem default

Colunas `NOT NULL` de `consorcio_produtos` e se o formulário envia:

| Coluna | Default | Formulário envia? |
|---|---|---|
| `id` | `gen_random_uuid()` | n/a |
| `codigo` | — | **sim** |
| `nome` | — | **sim** |
| `faixa_credito_min` | — | **sim** |
| `faixa_credito_max` | — | **sim** |
| `taxa_antecipada_percentual` | — | **sim** |
| `taxa_antecipada_tipo` | — | **sim** |
| `prazos_disponiveis` | — | **NÃO ← o erro atual** |
| `comissao_base` | `'valor_credito'` | sim (redundante) |

**`prazos_disponiveis` é a única NOT NULL sem default que falta.** Todo o resto que é NOT NULL ou tem default ou já vai no payload. Antony não bate numa segunda parede de NOT NULL. (Tudo o mais — `taxa_adm_*`, `fundo_reserva`, `seguro_vida_percentual`, `grupo_padrao`, `objetivo_option_id`, `prazo_maximo_venda`, `comissao_schedule`, `created_by`, `updated_by` — é nullable ou tem default.)

## D. O formulário representa auto? Não.

- As únicas colunas de taxa adm são `taxa_adm_200`, `taxa_adm_220`, `taxa_adm_240`. **Não existe onde guardar taxa adm de 100 meses** como campo próprio. O que aconteceria com um auto de 100 meses: `getTaxaAdm` (`src/lib/consorcioCalculos.ts:6-15`) faz `if (prazo < 210) return taxa_adm_200` — ou seja, **prazo 100 lê a coluna rotulada "200m"**. Como o Antony pôs 20,80 nos três campos, o número sairia certo por acidente, mas o rótulo mente: o campo diz 200 meses e está guardando a taxa de um produto de 100.
- `prazos_disponiveis` para esse produto deveria conter `{100}` (ou a grade real de auto), não `{200,220,240}`. É exatamente o campo que hoje ninguém preenche.
- **Não existe nenhum produto de Auto nem de Pesado entre os 7.** As opções de objetivo `auto` e `pesado` existem em `consorcio_objetivo_options` (ambas `is_active = true`), mas nunca foram usadas em produto. **Auto nunca foi cadastrado nesse sistema.**

## E. Quem consome os prazos — o sistema é 200/220/240 por construção

Confirmado, e é mais duro do que só a constante:

- `consorcio_creditos` tem **colunas fixas por prazo**: `parcela_1a_12a_{conv,50,25}_{200,220,240}` e `parcela_demais_...` — 18 colunas, nenhuma para outro prazo. Não há coluna `prazo`; o prazo está no *nome* da coluna.
- `PRAZOS_TABELADOS = [200, 220, 240]` (`src/hooks/useConsorcioPlanosCarta.ts:15`) e `filtrarPlanosCarta` devolve `prazoForaDaTabela: true` e **lista vazia** para qualquer outro prazo (linhas 106-113). Com prazo 100, **o seletor de plano da carta não oferece nada**.
- `resolverParcelaOficial` (`src/lib/consorcioParcelaOficial.ts:80-142`): monta o nome da coluna via `getValoresTabelados`; sem coluna para 100, `usandoTabelaOficial` fica `false` e cai em `calcularParcela`, que usa a taxa adm da coluna "200m". Ou seja: **não quebra, mas sai do regime de tabela oficial e passa a calcular** — o oposto da regra "a tabela é a fonte de verdade".
- `DadosPlanoFields.tsx:107` (`prazoSemTabela`) e `lerValoresTabela` (linha ~113) também rejeitam qualquer prazo fora de `[200,220,240]`.

Um agravante que apareceu no caminho e que vale para qualquer produto de auto: **a resolução de produto ignora o objetivo.** `resolverParcelaOficial` filtra só por `taxa_antecipada_tipo` + faixa de crédito, com `limit(1)` (linhas 89-98), e `produtosElegiveisParaCarta` faz o mesmo. A faixa do auto (45k–180k) **se sobrepõe** à faixa dos imóveis Parcelinha (120k–600k). Entre 120k e 180k, com "Parcelinha", o sistema poderia casar um crédito de imóvel com um produto de auto (ou vice-versa) sem nada distinguir. Isso é independente do NOT NULL e vale registrar.

## F. Saídas possíveis — sem escolha feita

**1. Campo explícito `prazos_disponiveis` no formulário.** Antony digita os prazos (ex.: `100`) e o insert passa.
Prós: uma tela, sem migração, nada de default chutado; o dado gravado é o que o operador afirmou. Contras: o produto de auto fica **meio cadastrado** — existe, aparece nas listas, mas nenhuma carta de 100 meses acha plano e a parcela sai calculada, não tabelada. E a taxa adm dele continua guardada num campo chamado "200m".

**2. `DEFAULT '{200,220,240}'` na coluna.** Destrava sem mexer na UI.
Prós: menor mudança possível. Contras: **é exatamente o risco que você nomeou** — o produto de auto nasce afirmando prazos de imóvel, e essa mentira fica no banco decidindo o dropdown de prazo. Você pediu para não dar default sem autorizar; registro como opção, não como recomendação.

**3. Suporte real a auto (prazos livres).** Obra maior: `consorcio_creditos` deixaria de ter prazo no nome da coluna (linhas por prazo, ou colunas genéricas), `PRAZOS_TABELADOS` deixa de ser constante, `getTaxaAdm` passa a ler uma grade de taxa por prazo em vez de três colunas fixas, e a resolução de produto passa a considerar objetivo para não colidir faixas. Prós: auto e pesado passam a funcionar de verdade, com tabela oficial. Contras: toca o núcleo do cálculo de parcela, que é o lugar mais sensível do sistema.

**4. Auto na prática também roda em 200/220/240, e "prazo máximo de venda 100" significa outra coisa.** Não posso confirmar nem derrubar isso pelo código — `prazo_maximo_venda` é null nos 7 produtos, então **nunca foi usado**, e não há nada no código que o leia além da exibição em `ConsorcioConfigModal.tsx:470`. Comercialmente, consórcio de automóvel Embracon costuma ter grade própria (tipicamente até 100 meses), o que torna improvável que auto use 200/220/240. Mas essa é a pergunta a levar ao dono: **a tabela de auto que o Antony tem na mão traz colunas de parcela para quais prazos?** A resposta decide entre 1 e 3.

## Nada foi tocado

Somente leitura: `information_schema`, `SELECT` em `consorcio_produtos`, `consorcio_creditos` e `consorcio_objetivo_options`, e leitura de arquivos. Nenhum INSERT/UPDATE/DELETE, nenhuma migração, nenhum arquivo de código alterado. Os 7 produtos estão como estavam.
