

## Funil por Canal dentro de "Aquisição & Origem" — BU Incorporador

### Objetivo

Adicionar uma nova seção dentro do relatório de **Aquisição & Origem** (rota `/bu-incorporador/relatorios` → card "Aquisição & Origem") com o **funil completo por canal** (A010, ANAMNESE [ex-LIVE], ANAMNESE-INSTA, LANÇAMENTO, OUTSIDE), mostrando todas as etapas do ciclo Inside Sales numa única tabela.

> **Nota terminológica:** o usuário pediu para renomear "LIVE" para "ANAMNESE" daqui para frente. Vou tratar isso na Etapa 4 abaixo.

### O que a seção nova vai mostrar

Tabela "Funil por Canal", uma linha por canal, com as colunas:

| Canal | Entradas | R1 Agend. | R1 Realiz. | Contrato Pago | R2 Agend. | R2 Realiz. | Aprovados | Reprovados | Próxima Semana | Venda Final | Faturamento |
|---|---|---|---|---|---|---|---|---|---|---|---|

- **Entradas:** total de leads do canal no período (deals criados + transações automáticas A010/Lançamento sem deal).
- **R1 Agendada / Realizada / No-show:** vindo dos `meeting_slot_attendees` R1 dos deals daquele canal, deduplicados por deal (mesma regra do `useR1CloserMetrics` — Realizada vence No-show).
- **Contrato Pago:** attendees com `status='contract_paid'` cujo deal é do canal.
- **R2 Agendada / Realizada:** attendees R2 dos mesmos deals.
- **Aprovados / Reprovados / Próxima Semana:** vindo de `useCarrinhoUnifiedData` (status do Carrinho), filtrado pelos deals do canal no período.
- **Venda Final:** transações Hubla pagas atribuídas ao deal daquele canal (mesma lógica do `useAcquisitionReport.classified` que já existe).
- **Faturamento:** soma de receita líquida das vendas finais do canal (já temos no `byChannel`).

Abaixo da tabela, **conversões agregadas** por canal: `R1 ag → R1 real %`, `R1 real → Contrato pago %`, `Aprovado → Venda final %`, `Entrada → Venda final %`.

### Como o canal de cada lead é determinado

Já existe `src/lib/channelClassifier.ts` (`classifyChannel`) usado em outros relatórios. Vou usar **a mesma função** para classificar cada **deal** (a partir de `tags`, `origin_name`, `lead_channel`, `data_source`). Para vendas sem deal vinculado (A010 / Lançamento automáticos), uso a classificação de transação (`detectChannel` em `useAcquisitionReport`, que já trata A010, LANÇAMENTO, ANAMNESE-INSTA, etc.). Assim o funil e a coluna de faturamento batem com o que já é mostrado em "Faturamento por Canal" hoje.

### Arquivos que vou criar/alterar

1. **Novo hook** `src/hooks/useChannelFunnelReport.ts`
   - Aceita `dateRange`, `bu`, e (opcional) filtros já existentes na tela (search, closer).
   - Reutiliza dados já carregados pelo `useAcquisitionReport` quando possível para evitar refetch.
   - Busca:
     - `crm_deals` criados no período (deal_id, tags, origin_name, custom_fields, lead_channel, data_source) — para "Entradas" e classificação.
     - `meeting_slot_attendees` + `meeting_slots` filtrados por `meeting_type` ∈ {r1, r2} e `scheduled_at` no período (já buscado em `useAcquisitionReport`, vou expor).
     - `useCarrinhoUnifiedData(weekStart, weekEnd)` para Aprovado/Reprovado/Próxima safra (atrelado ao deal_id).
   - Aplica deduplicação por deal nas etapas (mesma regra do `useR1CloserMetrics` que acabamos de corrigir).
   - Retorna `Array<ChannelFunnelRow>` + totais.

2. **Atualizar** `src/components/relatorios/AcquisitionReportPanel.tsx`
   - Importar o novo hook e renderizar a seção **"Funil por Canal"** logo abaixo do KPI cards e acima de "Faturamento por Closer".
   - Botão de export Excel: adicionar uma nova aba "Funil por Canal" no XLSX existente.
   - Filtros existentes (período, canal, closer) continuam aplicáveis também à nova tabela.

3. **Novo componente** `src/components/relatorios/ChannelFunnelTable.tsx`
   - Tabela responsiva com sticky header, formatação numérica e badges de conversão.
   - Linha de "Total" no rodapé.

4. **Renomear "LIVE" → "ANAMNESE" no canal padrão (UI only)**
   - Em `src/lib/channelClassifier.ts` e `src/hooks/useAcquisitionReport.ts` o **fallback** que hoje devolve `'LIVE'` continua existindo internamente (para não quebrar relatórios históricos), mas no **label exibido** dentro do novo funil e no dropdown de Canal vou trocar para `ANAMNESE (ex-LIVE)`. Não vou alterar o valor armazenado — somente a renderização — assim relatórios antigos não quebram.
   - Confirmar com você se quer que eu renomeie globalmente (mais arriscado, afeta todos os relatórios) ou só visual (seguro).

### Validações de qualidade

- A coluna **Faturamento** da nova tabela tem que bater com a tabela "Faturamento por Canal" já existente (mesmo período).
- Soma de **Entradas** por canal ≥ soma de R1 Agendada (lead pode entrar e não ter R1 ainda).
- Soma de **Venda Final** por canal = `kpis.totalTransactions` quando filtros não estão aplicados.
- Aprovado/Reprovado/Próxima Semana só fazem sentido para a janela do Carrinho da semana atual; se o período do filtro for maior que 1 semana, agrego por todas as semanas tocadas e somo.

### O que NÃO faz parte deste plano

- Não vou criar nova rota — tudo dentro do mesmo painel "Aquisição & Origem".
- Não vou alterar o classificador global de canais nem o RPC `get_first_transaction_ids`.
- Não vou criar nada para outras BUs neste momento — o foco é Incorporador (mas o hook é genérico e poderá ser ativado em outras BUs depois trocando o `bu` prop).
- Renomeação física `LIVE → ANAMNESE` no banco/RPC fica fora — só label de UI.

### Reversibilidade

Hook e componente novos, isolados. Reverter = remover importação no `AcquisitionReportPanel` e apagar os 2 arquivos novos.

