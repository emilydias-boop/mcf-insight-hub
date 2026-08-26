# Mapa do fluxo "Adicionar Carta" — somente leitura (nada implementado)

Objetivo futuro: impedir que o closer crie lead novo quando já existe lead com R1 de consórcio (casos Rodrigo e Naufel). Este documento é só o mapa; a implementação fica para uma próxima rodada aprovada.

## 1) AddCartaModal.tsx — campos, ordem e o ponto de decisão

Arquivo: `src/components/consorcio/AddCartaModal.tsx` (618 linhas).

Ordem do formulário:
1. **"1. Lead no CRM (obrigatório)"** (`:397-517`) — bloco de vínculo do lead.
2. **"2. Dados da venda"** (`:520-572`): cartas via `CartasProposalEditor` (crédito, prazo, produto, parcelas — `:523-529`), origem da venda (`:532-542`), detalhe da origem (`:543-550`), **Closer responsável** (`:551-561`) e **Data de aceite** (`:562-565`), observações (`:568-571`).
3. **"3. Dados cadastrais do cliente"** (`:574-594`, colapsável): `TipoPessoaSelect` + `DadosClienteFields` — nome, CPF/CNPJ, RG, telefone, e-mail etc. (`DadosClienteBloco.tsx:63-69`). Nome é pré-preenchido pelo lead selecionado (`:181`, `:222`).

**Ponto de decisão "usar lead existente vs criar novo"** — é o primeiro bloco do modal:
- Existe busca de lead, sim: popover "Buscar lead..." (`:404-461`) alimentado pelo hook local `useConsorcioLeadSearch` (`:83-152`).
- Critérios da busca (`:93-115`): casa em `crm_contacts` por `name ILIKE`, `email ILIKE` e, se houver ≥4 dígitos, `phone ILIKE %digitos%`; depois pega `crm_deals` desses contatos **restritos às origens da BU Consórcio** (`bu_origin_mapping` + EA fixo, `:56-71`, filtro `.in('origin_id', originIds)` em `:112`), não arquivados, 1 deal por contato (`:133-137`).
- **Não há nenhuma verificação de reunião/R1** — a busca não olha `meeting_slots` nem sela "tem R1 de consórcio". O lead certo do Naufel existia, mas nada na tela avisava que ele tinha R1 com o André.
- Criação de lead novo acontece por dois caminhos: botão `Criar "<termo>" no CRM` dentro do estado vazio da busca (`:429-441`), ou botão sempre visível "Criar lead novo no CRM" (`:463-466`) que abre campo de nome próprio (`:475-516`). Ambos caem em `criarLeadNovo` (`:240-303`).

## 2) Criação do lead novo — o que nasce (e o que não nasce)

`criarLeadNovo` (`AddCartaModal.tsx:240-303`), direto via `supabase.from(...).insert`, sem hook dedicado:
- `crm_contacts`: insert só com `{ name, clint_id: 'local-...' }` (`:251-255`) — **sem telefone, sem e-mail, sem CPF**.
- `crm_deals`: insert com `name`, `contact_id`, `origin_id = EA_ORIGIN_ID` (Efeito Alavanca + Clube), `stage_id = EA_ENTRADA_STAGE_ID` ("Parceiros") e `clint_id` sintético (`:260-270`) — **sem `owner_id`**, sem nenhum outro campo.
- Ou seja: o lead nasce sem dono, sem telefone e sem e-mail **porque o modal não passa** — não é o usuário pulando; o formulário de criação (`:475-516`) só pede o nome. Os dados cadastrais (telefone/e-mail/CPF) são preenchidos depois no bloco 3 e vão para `consorcio_pending_registrations` (`:342-367`), nunca de volta para o contato/deal.
- Consequência medida nos dois casos: a busca do próprio modal (que depende de contato com telefone/e-mail) nunca reencontraria esses leads órfãos por telefone/e-mail.

## 3) Onde plugar a verificação de reunião de consórcio

O sinal decisivo nos dois casos foi **vendedor da cota = closer da reunião**. No modal, o closer é escolhido no bloco 2 (`:551-561`, state `closerId` em `:173`), DEPOIS do bloco do lead. Portanto o gatilho natural é:

- **Ponto A (mais fraco):** enriquecer a lista de busca `useConsorcioLeadSearch` (`:83-152`) com selo de R1 — funciona quando o usuário busca, mas não cobre quem clica direto em "Criar lead novo".
- **Ponto B (recomendado):** em `criarLeadNovo` (`:240-303`), antes do insert — mas nesse ponto só há o nome; o `closerId` já pode estar preenchido se o usuário preencheu o bloco 2 antes (ordem não é travada).
- **Ponto C (o mais seguro):** no `handleSubmit` (`:306-382`), antes de `enviarProposta` — aqui o modal tem TUDO (ver item 5): `lead.deal_id`, `closerId`/`closerNome` (`:187-190`), `aceiteDate`, e os dados cadastrais. Se o lead selecionado foi criado pelo próprio modal (flag a ser criada, ex.: `lead.origin_id === EA_ORIGIN_ID && lead.stage_name === 'Parceiros'` recém-criado) e existir outro deal com R1 de consórcio do mesmo closer na janela, bloquear/avisar.

## 4) Reaproveitamento dos hooks existentes (`useCorrigirVinculoCota.ts`)

- **`useR1ConsorcioPorDeal(dealIds, enabled)`** (`:68-129`): recebe array de `deal_id` e devolve `Map<dealId, {dia, closerName, temAgendador}>`, filtrando closers da BU Consórcio e attendees não cancelados/invited. **Serve direto** para selar os resultados da busca do AddCartaModal (basta passar os `deal_id` dos matches). Não filtra por janela de datas nem por closer específico — para o sinal "mesmo closer na janela" precisaria de `closer_id` e `scheduled_at` no retorno (hoje `closerName` e `dia` já saem; dá para comparar nome e data no cliente sem alterar o hook).
- **`useLeadsParaVinculo(titular, termo, buscaAmpla, enabled)`** (`:161-281`): exige `titular` (vem de `useCotaTitular`, que lê `consortium_cards` — `:17-44`). **Não serve direto**: no AddCartaModal ainda não existe `consortium_cards`. Mas o corpo da query é reutilizável: casa por e-mail exato, telefone (9 dígitos finais), nome com/sem acento, e reforço por CPF/CNPJ via `consorcio_pending_registrations` (`:252-276`). O que precisaria mudar: aceitar um "titular sintético" (objeto com nome/cpf/telefone/email vindos do formulário `useDadosCliente`) em vez de depender de `cardId`. O filtro de origem também difere: `useLeadsParaVinculo` não restringe por BU; o modal atual restringe.
- Conclusão: `useR1ConsorcioPorDeal` pluga sem mudança; `useLeadsParaVinculo` pede uma variante que receba os dados do titular por parâmetro.

## 5) Dados disponíveis em cada instante

| Dado | Na busca de lead (bloco 1) | No "criar lead novo" | No submit |
|---|---|---|---|
| Nome do titular | só o termo digitado | sim (campo nome) | sim (form cadastral) |
| CPF/CNPJ | não | não | sim (bloco 3, opcional) |
| Telefone / e-mail | não | não | sim (bloco 3, opcional) |
| Vendedor (closer) selecionado | não (bloco 2 vem depois) | possível, se usuário preencheu antes | **sim, obrigatório** (`:201`) |
| Data de aceite | não | possível | sim (default hoje, `:174`) |

Decisivo: o sinal forte (vendedor = closer da R1 + janela de dias) **só é garantido no submit** (Ponto C). Um aviso mais cedo (Ponto A, selo "tem R1 de consórcio" nos resultados da busca) funciona com os dados do bloco 1 e é barato — recomendação: combinar A (orienta a escolha) + C (bloqueia a duplicação).

## 6) Permissão e uso — quem abre o modal

- O modal só é renderizado em `src/pages/crm/PosReuniao.tsx` (`:16`, `:235`, botão "Adicionar Carta" em `:736-739`, render em `:769`).
- A tela fica em `/consorcio/crm/venda-consorcio` (e legado `/pos-reuniao`), dentro do layout `consorcio/crm` com `ResourceGuard resource="crm"` (`App.tsx:250,257-258`). Papéis com recurso `crm`: Admin, Coordenador, Manager e Asst. Adm (BU Consórcio) com acesso total; SDR e Closer com visualização — **não há nenhum gate adicional no botão nem dentro da página** (nenhum uso de papel em `PosReuniao.tsx`). Ou seja: qualquer papel que abre a tela, inclusive closer (André, João Pedro), clica em "Adicionar Carta".
- Se closers deveriam continuar lançando carta (casos parceiro/indicação legítimos), a correção não pode ser "esconder o botão" — tem que ser a verificação de R1 nos pontos A/C acima.

## Próximo passo (quando autorizado)

Implementar em rodada separada: (a) selo de R1 de consórcio nos resultados da busca reutilizando `useR1ConsorcioPorDeal`; (b) verificação no `handleSubmit`/`criarLeadNovo` — se houver outro deal com R1 de consórcio cujo closer bate com o vendedor selecionado dentro de uma janela de dias, exigir confirmação explícita ou vincular ao lead existente. Escopo exato a definir com o dono antes de escrever código.
