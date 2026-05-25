## Visão geral

Após contemplação, a cota pode seguir três caminhos: (1) ficar com o consorciado, (2) ser colocada à venda, (3) ser transferida a um comprador. Modelaremos a transferência como um **processo paralelo** anexado à carta original, com **fases (kanban)**, **precificação**, **comprador**, **análise de crédito**, **documentação**, **financeiro de evento** e **conclusão**. Ao concluir, a própria carta tem seus dados de titular atualizados (sem duplicar a carta) e o histórico do antigo titular fica no log.

## Status na carta contemplada

Adicionamos em `consortium_cards`:

- `pos_contemplacao_decisao`: `null | 'manter' | 'a_venda' | 'em_transferencia' | 'transferida'`
- `data_decisao_pos_contemplacao`

No drawer da carta contemplada aparece o bloco **"Pós-contemplação"** com 3 ações:
- Manter com consorciado
- Colocar à venda (não inicia processo, só marca como disponível)
- Iniciar transferência (cria o processo)

## Tabelas novas

### `consortium_transfers` (1 por processo, 1:1 com carta enquanto ativo)
- `card_id` (FK)
- `status_fase`: `precificacao | comprador | analise_credito | documentacao | transferencia_oficial | financeiro | concluida | cancelada`
- **Contemplação base**: `tipo_contemplacao` (`sorteio_50`, `sorteio_25`, `lance_50`, `lance_25`, `lance_fixo`), `usou_capital_proprio` (bool), `valor_capital_proprio`, `data_assembleia`
- **Precificação**: `valor_lance`, `valor_credito_disponivel`, `valor_repasse_consorciado` (quanto o vendedor da cota recebe), `valor_comissao_empresa`, `valor_total_comprador` (entrada do novo titular), `observacoes_precificacao`
- **Análise de crédito**: `analise_status` (`pendente | em_analise | aprovado | reprovado`), `analise_data`, `analise_observacao`
- **Transferência oficial**: `protocolo_admin`, `data_envio_admin`, `data_efetivacao`, `nova_cota` (string opcional)
- Datas: `iniciado_em`, `concluido_em`, `cancelado_em`, `motivo_cancelamento`

### `consortium_transfer_buyers`
Dados do novo titular (PF/PJ) — mesmo shape dos campos de `consortium_cards` (nome/cpf/endereço/contato OU razão/cnpj). Mantido separado até a conclusão para preservar a carta original; ao concluir, esses dados sobrescrevem o titular na carta.

### `consortium_transfer_documents`
Upload de documentos por processo (`tipo`, `nome_arquivo`, `storage_path`, `uploaded_by`).

### `consortium_transfer_financials` (evento financeiro separado)
Linhas do tipo:
- `entrada_comprador` (a receber do comprador)
- `repasse_consorciado` (a pagar ao titular atual)
- `comissao_empresa` (receita da empresa)
- `taxa_administradora` (custo, opcional)

Campos: `tipo`, `valor`, `data_prevista`, `data_realizada`, `status` (`previsto | recebido | pago`), `observacao`. Não toca em `consortium_installments` — o cronograma de parcelas existente continua intacto.

## Fluxo na UI

Novo componente `TransferProcessDrawer.tsx` aberto a partir da carta contemplada. Estrutura em **abas**, espelhando as fases:

1. **Resumo** — badges de fase, KPIs (lance, repasse, comissão), botão "Avançar fase"
2. **Contempl. & Precificação** — formulário com tipo, capital próprio, lance, cálculo automático de repasse/comissão/total comprador
3. **Comprador** — formulário PF/PJ (reusa componentes existentes do cadastro de carta)
4. **Análise de crédito** — status + observação + data
5. **Documentação** — lista de docs (reusa padrão de `ConsorcioDocument`)
6. **Transferência oficial** — protocolo, datas, nova cota
7. **Financeiro** — tabela das linhas de `consortium_transfer_financials` com marcar como recebido/pago
8. **Histórico** — log de eventos do processo (usa `consortium_card_activity_log` com `category='transferencia'`)

Botão **Concluir transferência** (visível só na última fase): aplica os dados do `consortium_transfer_buyers` no titular da carta, marca carta com `pos_contemplacao_decisao='transferida'`, fecha o processo.

## Regras de negócio

- Só pode iniciar transferência se a carta estiver `motivo_contemplacao IS NOT NULL`.
- Apenas 1 transferência ativa por carta (`status_fase != 'concluida'/'cancelada'`).
- Avançar fase exige preenchimento mínimo da fase atual (validação client + trigger).
- Cancelamento exige `motivo_cancelamento`; não apaga registros.
- Log automático (trigger) para qualquer mudança de fase, status financeiro, conclusão.
- RLS: mesmas regras de visibilidade da carta (quem vê a `consortium_cards` vê o processo).

## Detalhes técnicos

```text
consortium_cards
   └── consortium_transfers (1:1 ativo)
         ├── consortium_transfer_buyers (1:1)
         ├── consortium_transfer_documents (1:N)
         └── consortium_transfer_financials (1:N)
```

Cálculos sugeridos na precificação (editáveis):
- `valor_credito_disponivel = valor_credito * (% contemplação)` — 50% ou 25%
- `valor_total_comprador = valor_lance + valor_capital_proprio` (entrada)
- `valor_comissao_empresa = valor_total_comprador * % configurável (default 10%)`
- `valor_repasse_consorciado = valor_total_comprador - valor_comissao_empresa`

Triggers:
- `tg_log_transfer_activity` em `consortium_transfers` (INSERT/UPDATE) → grava em `consortium_card_activity_log` (category `transferencia`)
- `tg_apply_transfer_on_complete` em `consortium_transfers` quando `status_fase` muda para `concluida` → copia campos do buyer para a carta e seta `pos_contemplacao_decisao='transferida'`

## Entregáveis

1. Migração: novas colunas em `consortium_cards`, 4 tabelas novas, RLS, triggers
2. Hooks: `useConsortiumTransfer`, `useTransferFinancials`, `useTransferDocuments`
3. Componente `TransferProcessDrawer.tsx` com as 8 abas
4. Botão "Pós-contemplação" no `ConsorcioCardDrawer` (aparece só em cartas contempladas)
5. KPI extra em `useConsorcioPagamentos`: `cartasEmTransferencia`, `transferenciasConcluidasMes`
6. Memória `mem://features/consorcio-transferencia-cota` documentando o fluxo

## Pontos abertos para confirmar antes de implementar

- Percentual default de comissão da empresa na transferência (10%? configurável por produto?)
- A "venda" da cota (status `a_venda`) gera anúncio interno ou só marca? Por enquanto só marca.
- Cota transferida deve continuar gerando comissão de parcelas para o vendedor original ou zera daqui pra frente?
