# Melhorias em Financeiro > A receber (conforme Especificação Técnica)

Princípio: nada do que existe muda de comportamento. Listagem, Esteira Cobrança, Reconciliação, Reembolsos, Cadastro Manual, Duplicidade, baixa em lote e a tela de detalhe continuam iguais. As melhorias usam os títulos e parcelas que já existem (sem cadastro novo nem tabela duplicada) e só leem dados, exceto as ações que já existem hoje (baixa, reagendar, mover para judicial).

## 1. Barra global de busca e filtros (topo, vale para todas as abas novas)
- Busca única por nome, telefone, e-mail, CPF, produto e nº do título.
- Filtros rápidos: Cobrador (resp. cobrança), Gerente de contas, Status, Produto e Período (mês atual, mês anterior, intervalo).
- Botão "Limpar filtros" e contador de filtros ativos.

## 2. Listagem (aba atual) — só acréscimos
- Novas colunas: Telefone com botões Ligar e WhatsApp; e-mail clicável; Forma de pagamento; **Próxima cobrança** (data e valor da próxima parcela pendente); **Dias de atraso** em vermelho.
- Destaques: saldo acima de R$ 10.000 em negrito vermelho; badge de status do cliente (Em dia verde, Atrasado vermelho, Judicial roxo, Quitado cinza), derivado das parcelas.
- Clique simples na linha abre um **painel lateral** com dados, cronograma de parcelas e histórico (duplo clique continua abrindo a página de detalhe).
- Exportar para Excel/CSV do que está filtrado.

## 3. Nova aba "Agenda de cobranças"
- Alternância Semana / Mês (semana de segunda a domingo).
- Cartões de resumo: Previsto, Recebido, A receber; na visão Mês, um bloco por semana com totais e o total do mês no topo; semanas vazias mostram R$ 0,00; semana atual destacada.
- Itens agrupados por cobrador com subtotal; cada item mostra cliente, "parcela 2/5", valor, vencimento e status.
- Ação rápida por item: Reagendar e Dar baixa (usando as mesmas ações da tela de detalhe). Judicial e cancelados ficam fora.

## 4. Nova aba "Pendências por mês"
- Chips com cada mês anterior que tem pendência (quantidade e total em aberto); padrão: mês anterior.
- Resumo: clientes pendentes, total em aberto, maior valor em aberto e maior atraso.
- Tabela: cliente, telefone (Ligar/WhatsApp), produto, cobrador, gerente, vencimento, previsto, pago, em aberto, dias de atraso.
- Ações: Dar baixa, Reagendar, Anotar e Encaminhar para judicial (com confirmação; usa a etapa "Cobrança judicial" que já existe na Esteira).
- Vazio: "Nenhuma pendência neste mês".

## 5. Nova aba "Inadimplência histórica"
- Todas as pendências de meses anteriores numa lista só, ordenada por saldo devedor, com a mesma fonte da aba Pendências (totais sempre batem) e a ação Encaminhar para judicial.

## 6. Nova aba "Resultados por cobrador"
- Cartões com total recebido por cobrador no período (padrão mês atual), gráfico de barras e ranking; conta também clientes que depois foram para judicial.

## Fora deste passo (precisam de decisão do negócio)
- Status manual "Negociação" e plano Fracionado/Recorrente com geração de séries: exigem campos novos; proponho um segundo passo depois de validar este.
- Restringir a aba Judicial só a Admin/Supervisor: hoje a tela já é limitada a admin/financeiro, então mantenho como está.
- Cancelar automaticamente parcelas restantes ao quitar: não incluído, pois mudaria o comportamento atual.

## Detalhes técnicos
- Fonte única: um hook novo `useArParcelasAgenda` lendo `ar_parcelas` + `ar_titulos` (sem os limites de 500 linhas por período, paginando). "Atrasada", saldo, próxima cobrança e dias de atraso são calculados no cliente com fuso America/Sao_Paulo; a lógica pura vai em `src/lib/arCobrancaCalc.ts` com testes (semanas com zero, pendências do mês, parcial mostrando só o em aberto, limite R$ 10.000).
- Componentes novos em `src/components/financeiro/aReceber/` (AgendaCobrancas, PendenciasMes, InadimplenciaHistorica, ResultadosCobrador, ClientePainelLateral, FiltrosGlobais). `AReceber.tsx` recebe apenas novas abas, colunas e o painel.
- Ações reaproveitam os hooks de `useAReceber` (baixa, update de parcela) e o stage judicial existente; nenhuma migração, RPC ou alteração de regras.
- Cores via tokens/variantes existentes; sem mudar outras telas.
