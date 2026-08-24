# Levantamento: Antony e Emily criando produtos (tabelas Embracon)

Nenhum código, migração ou dado foi tocado. Só leitura de banco e de código.

## A. Policies de `consorcio_produtos`

Existe **uma única policy** na tabela:

| Comando | Policy | Papéis | Condição |
|---|---|---|---|
| SELECT | "Usuários autenticados podem ler produtos" | `authenticated` | `true` |
| INSERT | **não existe** | — | — |
| UPDATE | **não existe** | — | — |
| DELETE | **não existe** | — | — |

RLS está ligada. Com RLS ligada e nenhuma policy para o comando, o comando é negado para **todos** os papéis do Data API. Foi exatamente isso que barrou o INSERT do Antony.

Para comparação, a tabela irmã `consorcio_creditos` (planos/valores tabelados) **tem** as quatro:
- SELECT: `authenticated`, `true`
- INSERT / UPDATE / DELETE: `has_role(admin) OR has_role(manager) OR has_role(cobranca_consorcio)`

Ou seja: hoje qualquer um desses três papéis cria/edita/apaga **plano**, mas ninguém — nem admin — cria **produto**.

## B. Quem são eles no banco

Cinco perfis casam com os nomes. Os relevantes:

- **Antony Nicolas Gomes Rosa** — `antony.nicolas@minhacasafinanciada.com` — papéis: `admin`, `assistente_administrativo`, `cobranca_consorcio`
- **Emily Caroline Dias** — `emily.dias@minhacasafinanciada.com` — papéis: `admin`, `cobranca_consorcio`

Homônimos/duplicados que existem e não devem ser confundidos:
- Antony Elias Monteiro da Silva — `antony.elias@…` — papel: `sdr`
- Emily Segundario — `emily.carolinedias@gmail.com` — papel: `sdr`
- Emily Dias — `emily.dias@minhacasafinanciada.com` (mesmo e-mail do perfil acima) — **sem papel nenhum**

Dois pontos que merecem decisão do dono, fora do pedido: os dois principais já têm `admin` acumulado, e existe um perfil duplicado com o e-mail da Emily. `user_roles` não guarda data de concessão (não há coluna de timestamp), então não é possível dizer desde quando.

## C. Por que o Antony falhou tendo `admin`

Porque a policy **não é sobre papel** — não há policy alguma para INSERT. `admin` não é privilegiado no Postgres; ele só passa onde alguma policy escreve `has_role(auth.uid(),'admin')`. Em `consorcio_produtos` isso nunca foi criado: a migração original liberou leitura e esqueceu escrita. Consequência prática: **os 7 produtos ativos hoje foram criados por migração/SQL direto, não pela tela.** A tela de produto nunca funcionou para ninguém.

## D. O que a tela grava

O modal "Criar produto" (`ConsorcioConfigModal.tsx` → `ProdutosTab`/`ProdutoForm`, via `useCreateConsorcioProduto`) grava em **uma só tabela**: `consorcio_produtos`. O cronograma de comissão não é tabela separada — é a coluna `comissao_schedule` (jsonb) na própria linha, junto de `comissao_base`. Não há segunda escrita, então não existe risco de "produto criado pela metade" nesse fluxo.

A segunda tabela aparece só na **aba Planos** (`PlanosTab`, `useConsorcioCreditosAdmin`), que grava `consorcio_creditos` — e essa já permite `admin`/`manager`/`cobranca_consorcio`. Se o pedido do dono inclui digitar os valores tabelados por faixa de crédito, essa parte **já está liberada** para os dois.

Detalhe estrutural: `consorcio_creditos.produto_id` referencia `consorcio_produtos` com **ON DELETE CASCADE**. Um DELETE real de produto levaria embora todos os planos dele.

## E. Estrago possível

**Propostas/cartas já gravadas:** não são alteradas por criar ou editar produto. O consumo é sempre em tempo de cálculo, na hora que alguém preenche/salva um formulário: `resolverParcelaOficial` (`src/lib/consorcioParcelaOficial.ts`) e `getProdutoComissaoContext` (`src/lib/produtoComissaoLookup.ts`) leem a tabela sob demanda e o resultado é gravado como valor no registro da carta/cota. Não há view materializada nem cache persistido apontando para produto.

**FK / trigger / cache que propague:**
- FKs referenciando `consorcio_produtos`: apenas `consorcio_creditos.produto_id` (CASCADE em delete).
- Triggers na tabela: apenas `update_consorcio_produtos_updated_at` (toca só `updated_at`).
- Nenhum trigger propaga para `consortium_cards`, `consorcio_pending_registrations`, `consorcio_proposals` ou termos.
- **O vetor retroativo real é manual:** `useRecalculateCommissions` (botão "Recalcular", hoje restrito a `admin`/`coordenador` em `CotasTab`) reprocessa comissões de registros existentes usando o produto **vigente**. Produto errado + alguém clicando em recalcular = comissões antigas reescritas.

**Criar × editar × apagar não são o mesmo risco:**
- **Criar** é o menos perigoso, com uma ressalva: `resolverParcelaOficial` escolhe o produto com `limit(1) … maybeSingle()` **sem ordenação determinística**, filtrando por `ativo` + `taxa_antecipada_tipo` + faixa de crédito. Um produto novo com faixa **sobreposta** a um existente pode passar a ganhar a disputa de forma imprevisível e mudar a parcela sugerida de vendas futuras inteiras.
- **Editar** é mais perigoso: altera silenciosamente a base de cálculo de tudo que vier depois, e alimenta o recálculo de comissão retroativo.
- **Apagar** pela tela é *soft delete* (`ativo = false`), então não dispara o CASCADE; mas some com o produto do matching e, por consequência, os planos ligados a ele deixam de ser encontrados (o lookup filtra por produto ativo). Um DELETE real (fora da tela) apagaria os planos em cascata.

## F. Trilha de auditoria

Praticamente não há. Colunas da tabela: sem `created_by`, sem `updated_by`. Só `created_at` e `updated_at`. Não existe tabela de auditoria para produto (`consortium_card_activity_log` cobre cota, não produto). **Resposta curta: não há trilha de quem criou ou alterou um produto.**

## G. Comportamento da tela hoje

Pior dos mundos, confirmado. O botão que abre o modal de configuração em `CotasTab.tsx` (linha 557) **não tem gate de papel nenhum** — quem chega na tela de Cotas vê. Dentro dele, a aba Produtos, o botão "Novo produto" e o "Criar produto" também não checam papel; a lixeira só pede um `confirm()`. Ou seja: qualquer usuário com acesso à tela preenche o formulário inteiro e só descobre no envio, via toast vermelho, que não pode — e o formulário fica com o trabalho perdido. E hoje isso vale para **todo mundo, admin incluído**.

## H. Opções (sem escolher)

Nota comum às três: como não existe policy de escrita, **qualquer** caminho exige criar policy nova — não há como "só dar um papel" e resolver.

**Opção 1 — dar a eles o papel que já tem essa permissão**
Não existe tal papel para produto. O papel que tem escrita na tabela *irmã* (`consorcio_creditos`) é `admin`/`manager`/`cobranca_consorcio`, e os dois **já têm** `admin` e `cobranca_consorcio`. Portanto essa opção é inaplicável ao pedido; nada a conceder.

**Opção 2 — criar policies de escrita espelhando `consorcio_creditos`** (`admin OR manager OR cobranca_consorcio`)
- Prós: consistente com a tabela irmã, uma migração pequena, os dois passam sem tocar em papéis.
- Contras / **o que libera além do pedido**: libera **todo** `admin`, **todo** `manager` e **todo** `cobranca_consorcio` — não só os dois. Se as policies incluírem UPDATE e DELETE, libera também **editar e apagar** produto, que o dono não pediu. Sem trilha (item F), não se saberá quem mexeu.

**Opção 3 — policy só de INSERT, sem UPDATE/DELETE**
- Prós: entrega exatamente "criar tabelas da Embracon" e nada mais; editar/apagar continua bloqueado para todos, como hoje.
- Contras: a tela mantém botões `Editar` e lixeira que vão continuar explodindo em toast (item G) — a UI ficaria mentindo para o usuário. E ninguém poderia corrigir um produto criado errado pela tela.

**Opção 4 — permissão específica** (recurso novo em `role_permissions`, ou papel dedicado tipo `config_consorcio`)
- Prós: granularidade real, dá para separar criar de apagar e para gatear o botão na UI pelo mesmo sinal, sem inflar `admin`/`cobranca_consorcio`.
- Contras: mais superfície — enum/tabela de permissão, policy usando o novo sinal, tela de gerenciamento de usuários e gate de UI. Mais caro que o pedido.

**Itens ortogonais que o levantamento expôs** (registrar, não consertar agora): o botão sem gate de papel (G), a ausência de trilha (F), o `limit(1)` sem ordenação em faixas sobrepostas (E), o CASCADE de planos no delete real (D) e o perfil duplicado da Emily sem papel (B).

## Próximo passo

Diga qual opção do item H seguir — e se ela deve incluir editar e apagar, ou apenas criar. Só então escrevo a migração.
