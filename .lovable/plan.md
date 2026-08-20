# Reforma do "Enviar Proposta": 1 proposta → N cartas

## (a) Modelo de dados recomendado

Tabela filha, como você inclinou. É o único caminho que preserva os números já publicados.

`consorcio_proposal_cartas`
- `id uuid pk`
- `proposal_id uuid not null` → `consorcio_proposals(id) on delete cascade`
- `ordem int not null` (1..N, define a exibição)
- `valor_credito numeric not null` (> 0, validado por trigger)
- `prazo_meses int not null`
- `tipo_produto text not null`
- `pending_registration_id uuid null` → cadastro pendente gerado por esta carta
- `consortium_card_id uuid null` → cota, quando nascer
- `created_at`, `created_by`

Grants: `select/insert/update/delete` para `authenticated`, `all` para `service_role`. RLS espelhando as políticas de `consorcio_proposals` (mesma BU/consórcio).

**Por que não alternativas:**
- *Guardar as cartas em JSON dentro da proposta*: não dá para ligar carta ↔ cadastro pendente ↔ cota, que é justamente o elo que falta hoje. Descartado.
- *Criar N propostas (uma por carta)*: quebraria a etapa 3 do funil (29 cartas negociadas viraria 89) e mexeria em número publicado. Descartado.
- *Usar `consorcio_pending_registrations` como lista de cartas*: é o que acontece hoje de fato e é a origem do problema — o cadastro nasce depois do aceite, sem `proposal_id`. Descartado.

**Agregados sincronizados por trigger** em `consorcio_proposal_cartas` (insert/update/delete):
- `consorcio_proposals.valor_credito` = soma dos `valor_credito` das cartas
- `prazo_meses` e `tipo_produto` = os da carta de maior crédito (moda simples), só para não deixar telas antigas vazias
- nova coluna `qtd_cartas int` na proposta (contagem), útil no grid

Assim toda tela que hoje lê `valor_credito` continua lendo o total correto, sem nenhuma alteração.

## (b) Migração das propostas existentes

Backfill idempotente: para cada proposta com `valor_credito > 0` e sem cartas, cria **uma** carta espelho (`ordem = 1`) com os valores atuais e, quando houver, `consortium_card_id` da própria proposta. Nenhum total muda (soma de 1 carta = valor atual). Propostas `aguardando_retorno` sem valor não geram carta.

Depois do backfill, todas as propostas têm ao menos 1 carta — o front pode ler só a tabela filha, com fallback ao campo agregado por segurança.

`consortium_card_id` na proposta **fica** (compatibilidade); passa a significar "primeira cota vinculada".

## (c) O que muda em "Cadastros Pendentes"

No aceite (`AcceptProposalModal`), em vez de 1 cadastro pendente, gera **um cadastro por carta**, todos com:
- `proposal_id` preenchido (mata os 51 órfãos)
- `valor_credito`, `prazo_meses`, `tipo_produto` da carta
- os dados de cadastro (PF/PJ, documentos) preenchidos uma vez e replicados nas N linhas
- `consorcio_proposal_cartas.pending_registration_id` gravado de volta

Efeitos:
- a conversão etapa 3 → 4 deixa de dar 306%: passa a ser "cartas da proposta" vs "cadastros criados", relação 1:1
- o caso Rodrigo (9× R$ 120.000) nasce completo da proposta, sem digitação manual repetida
- o fatiamento vira indicador próprio: "cotas por carta"
- o fluxo manual de criar cadastro solto continua existindo (não removo nada), mas deixa de ser o caminho normal

Nesta entrega **não** mexo em nenhum número histórico: agosto continua com os cadastros que já tem; só os aceites novos passam pelo caminho novo.

## (d) Telas que leem `valor_credito` / `prazo_meses` / `tipo_produto` da proposta

Todas continuam funcionando via agregado sincronizado; nenhuma precisa de ajuste obrigatório:
- `useProposals` (grid Cartas Negociadas) — passa a mostrar também "3 cartas · R$ 500.000"
- `useConsorcioPipelineMetrics` / `...BySdr` / `...ByCloser`, `useConsorcioRealizadoByCloser`, `BIConsorcio` — somam `valor_credito`: total inalterado
- `useLeadReport`, `WeekDetailDialog`, `useConsorcio`, `usePendingOutcomes` — leitura descritiva
- `useExcluirProposta` — log de exclusão passa a guardar também o snapshot das cartas
- Edge functions (`consorcio-carta-cadastrada-webhook`, `external-query`, `notify-pending-outcomes`) — leem o agregado, seguem iguais

Painel Comercial e regras de atribuição: **não são tocados**.

## Formulário (UI)

`ProposalModal` e `EditProposalModal`:
- sai o campo único de crédito; entra lista de cartas com Valor / Prazo / Tipo por linha
- "Adicionar carta", "Duplicar" por linha, remover (bloqueado na última)
- atalho de repetição em massa: no botão duplicar, um campo "×N" ao lado — digita 9, clica, e nascem 9 cópias da linha (1 clique + 1 número)
- rodapé fixo com total ao vivo: "3 cartas · R$ 500.000"
- registrar bloqueado enquanto houver linha incompleta, com destaque na linha faltante
- Detalhes da Proposta e Origem do Lead permanecem no topo, inalterados
- edição de proposta antiga abre com a carta espelho já preenchida

## Ordem de execução

1. Migração: tabela + grants + RLS + triggers de agregado + backfill
2. Hooks: leitura/escrita das cartas em `useEnviarProposta`, `useEditarProposta`, `useProposals`
3. UI dos dois modais
4. Aceite gerando N cadastros pendentes com `proposal_id`
5. Conferência: totais de agosto (55 cotas / 24 vendas / R$ 9,94 mi) e etapa 3 do funil inalterados

Sem publicar.
