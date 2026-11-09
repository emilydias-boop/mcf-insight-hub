# Ajustes complementares — Área de Cobranças e Reembolsos

## Avaliação do documento
O documento é **complementar**: repete o que já foi entregue (Agenda, Inadimplência, Resultados, contato rápido, destaques, busca e filtros) e acrescenta itens novos e correções. Nada nele pede para desfazer algo já feito. Dois pontos pedem cuidado:
- "Cobrança Regular" vira o nome da aba Listagem; a Esteira, a Reconciliação, a aba Pendências e a Duplicidade continuam.
- "Supervisor" não existe como perfil no sistema. Proposta: campos críticos ficam com Admin e com os gestores de A receber já cadastrados (o botão de gestores que já existe).

## O que muda

### 1. Abas
- Renomear "Listagem" para **Cobranças Regulares** (mesmo conteúdo).
- Nova aba **Cobrança Jurídica**: só os clientes em jurídico, com saldo, histórico e anotações, e opção de devolver para a cobrança regular (só Admin/gestor).
- Clientes em jurídico **somem** de Cobranças Regulares, Agenda, Pendências, Inadimplência e Esteira (Agenda e Pendências já excluem). Resultados continua somando o que já foi recebido deles.
- Nova aba **Relatórios e Notas**:
  - Total arrecadado por mês e por cobrador em cada mês, com filtro de período e de **evento/campanha** (ex.: "Ação Quite Já 2026", "Cobrança regular").
  - Cada baixa poderá receber um evento; Admin/gestor pode corrigir valor, data, cobrador e evento da baixa, com registro no histórico.
  - **Bloco de notas geral** da equipe, sem vínculo a cliente (data, hora e autor).
- **Reembolsos**: continua igual, com aviso dos reembolsos perto do prazo limite (cartão 180 dias, PIX 90 dias) ou da data prevista. Contador no botão Reembolsos e alerta ao abrir a tela (7 dias, ajustável).

### 2. Campos do cliente
- Status com tag colorida incluindo **Negociação** (marcado manualmente; Em dia/Atrasado/Quitado continuam automáticos).
- Coluna **Entrada** e coluna **Pago via cobranças** (separadas, vinculadas ao cobrador).
- Saldo devedor calculado: Valor total − Entrada − Pagos via cobrança.
- Gerente de contas e cobrador visíveis na linha; linha do tempo com data, hora e usuário (já existe no painel lateral).

### 3. Permissões
- Valores, mudança para Jurídico, reatribuição de cobrador e edição de baixas: só Admin e gestores de A receber. Os demais veem e anotam.

### 4. Exportação e correções
- Exportação já traz telefone (CSV novo); incluir também cobrador, gerente, entrada e status.
- **Forma de pagamento editável** no título; o prazo limite de reembolso se recalcula automaticamente pela nova forma.
- **Correção — parcelas de recorrência somem após uma baixa:** hoje, quando o pago alcança o "valor total" do título, o sistema apaga as parcelas restantes. Em recorrência o valor total pode não representar o contrato inteiro. Passa a valer: nada é apagado automaticamente; parcelas restantes só saem por ação manual ou baixa total confirmada.
- **Correção — baixa "quitado" duplica o valor recebido:** no banco há cerca de 200 títulos com valor pago maior que o total (A001, A009, A005, A003). A baixa em lote passa a lançar só o saldo realmente em aberto e não cria parcela integral quando já há pagamento. Primeiro passo: conferir alguns casos reais para confirmar a causa antes de corrigir; os títulos já afetados serão listados para revisão, sem correção automática.
- **Reembolso com erro:** ao editar ou excluir o pagamento de um reembolso já pago, ele volta para "A pagar" e aguarda nova confirmação manual, com registro no histórico.

## Fora deste passo
- Planos Fracionado/Recorrente com geração de séries (continua no próximo passo, como combinado).

## Detalhes técnicos
- Migração: colunas `negociacao` (bool) em `ar_titulos`; `evento` e `cobrador_id` em `ar_parcelas` (preenchido com o cobrador do título na baixa); tabelas `ar_eventos` (catálogo) e `ar_notas_gerais`, ambas com grants e RLS admin/financeiro; edição de baixas só para admin/ar_gestores via `can_manage_ar`.
- `settleTituloIfFullyPaid` deixa de apagar parcelas; `useBaixarTitulosLote` baixa `valor - valor_pago` e só cria entrada integral quando não há nenhum pagamento.
- Filtro de jurídico aplicado em `useArTitulos` (opção padrão) e no Kanban; aba Jurídica lê `cobranca_stage='judicial'`.
- `useEditarReembolso`/`useExcluirReembolso`: se alterar dados de pagamento, status → `pendente` e limpa `data_pagamento`.
- Aviso de reembolsos usa as mesmas funções de prazo do painel atual.
- Testes em `src/lib/arCobrancaCalc.test.ts`: saldo = total − entrada − pagos; jurídico fora das visões regulares; baixa em lote não ultrapassa o total.
