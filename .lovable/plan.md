# A Receber no formato do modelo "Cobrança B2B"

Objetivo: deixar Financeiro > A receber com a mesma organização de tela do modelo (barra de filtros no topo, abas em linha, 4 indicadores, tabela compacta). Cores, fontes e componentes continuam os do app. Nenhuma regra de cálculo, permissão ou dado muda.

## 1. Barra superior fixa (vale para todas as abas)
- Uma linha só: busca larga ("Buscar nome, telefone, e-mail, produto…") + filtros Cobrador, Gerente, Status e Período.
- Os mesmos filtros servem para todas as abas (hoje Cobranças Regulares tem filtros próprios e as abas de gestão têm outros).
- Os filtros extras que existem hoje (Tipo, Produto, Nº do título, Stage cobrança) ficam num botão "Mais filtros" ao lado, para não perder nada.

## 2. Abas em linha, estilo sublinhado
- Trocar os cartões grandes com ícone por abas em texto, com sublinhado na aba ativa, na ordem do modelo: Cobranças Regulares, Agenda de Cobranças, Pendências por Mês, Inadimplência Histórica, Cobrança Jurídica, Resultados por Cobrador.
- Depois delas, as abas que só o app tem: Esteira Cobrança, Reconciliação, Relatórios e Notas.
- Reembolsos, Cadastro Manual, Duplicidade e Gestores viram botões pequenos à direita da linha de abas (com o contador "perto do prazo" no Reembolsos).

## 3. Cobranças Regulares
- Título + subtítulo: "Clique na linha para detalhes · clique duplo na próxima cobrança para editar".
- 4 indicadores: Clientes, Saldo devedor total, Pago via cobranças (verde), Com cobrança vencida (vermelho). Os indicadores atuais de reembolso saem do topo e ficam no botão Reembolsos; valor contratado e parcelados aguardando lançamento vão para uma linha discreta abaixo dos 4.
- Colunas na ordem do modelo: Cliente, Telefone (com ligar e WhatsApp), E-mail, Status (etiqueta Em dia / Atrasado / Negociação / Quitado / Cancelado), Produto, Gerente, Cobrador, Valor ofertado, Forma, Entrada, Pago, Saldo devedor, Próxima cobrança (data + valor + "X dias de atraso" em vermelho), ação de confirmar.
- Mantidos do app: caixa de seleção para baixa em lote (primeira coluna), Nº do título e Parcelas (aparecem em letra menor sob o nome do cliente), Exportar CSV (botão no topo da tabela).
- Linhas mais baixas e números alinhados como no modelo; saldo e data em atraso em vermelho.
- Clique abre o painel lateral (já existe); duplo clique na próxima cobrança abre a edição da parcela.

## 4. Demais abas
- Agenda, Pendências, Inadimplência, Jurídica e Resultados recebem o mesmo cabeçalho (título + subtítulo + indicadores no mesmo formato) e tabelas no mesmo estilo compacto. Conteúdo e ações continuam iguais.

## O que não muda
- Cálculos, baixa em lote, permissões, Esteira, Reconciliação, Reembolsos, painel lateral e exportação.

## Detalhes técnicos
- Arquivos: `src/pages/financeiro/AReceber.tsx` (barra, abas, KPIs, tabela), `GestaoCobranca.tsx` (passa a receber os filtros da barra em vez de ter barra própria), `AReceberExtras.tsx` (cabeçalhos).
- Filtros compartilhados num estado único no `AReceber.tsx`; filtragem continua em `arCobrancaCalc.ts` / filtros atuais, sem nova consulta.
- Status visual derivado: Negociação (flag existente) > Atrasado (parcela vencida em aberto) > Em dia; quitado/cancelado pelo status do título.
- Somente tokens do design system (destructive, primary, muted, success existentes); nada de cores fixas novas.
- Teste existente `arCobrancaCalc.test.ts` deve continuar passando; adicionar teste para a regra de status derivado.
