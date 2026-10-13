# Visão Geral do Pós Venda (painel próprio + visão por gerente)

Só a Visão Geral do CRM do Pós Venda muda. As Visões Gerais das outras BUs continuam iguais.

## 1. Título
- "Painel de Controle do Funil Comercial" vira **"Painel de Controle do Pós-Venda"** só nessa BU.

## 2. Saúde da pipeline — No período (Hoje / Semana / Mês)
- **Entraram:** clientes que entraram na etapa "Novos licenciados" no período.
- **Já trabalhados:** clientes com algum contato no período: ligação com mais de 60 segundos, nota de contato, WhatsApp ou reunião registrada.
- **Sem toque:** clientes que ainda estão em "Novos licenciados" e não foram encaminhados.
- **Avançados:** clientes encaminhados no período para Consórcio ou Crédito Imobiliário.

## 3. Saúde geral
- **Abertos:** clientes em "Reunião de Viabilidade 1" sem nota e sem anexos de entregáveis.
- **Parados:** clientes sem nenhuma atividade registrada.
- **Envelhecidos:** clientes sem contato há mais de 15 dias.
- O "Tempo médio sem movimentação" e os "Travados por etapa" continuam, só com dados do Pós Venda.

## 4. Botão "Visão por gerente"
Ao lado do seletor de período. Mostra uma tabela com uma linha por gerente de relacionamento (o dono do card), com:
- Os 8 números acima, por gerente.
- Reuniões (Hoje / Semana / Mês, conforme o período escolhido): **agendadas, realizadas, no-show, reagendamentos** e **viabilidades concluídas** (cards que chegaram em "Viabilidade Concluída").
- Uma linha de total no fim.

## Pontos para você confirmar
- Hoje não existe nenhuma reunião agendada na agenda do Pós Venda. Por isso as colunas de reuniões vão aparecer zeradas até os gerentes começarem a usar a agenda.
- "Parados" fica sem limite de dias: só entra quem nunca teve nenhuma atividade. Se quiser um prazo (ex.: 3 dias sem atividade), me diga.

## Detalhes técnicos
- `Overview.tsx`: se `useActiveBU() === 'pos_venda'`, renderiza o novo `PosVendaDashboard`; caso contrário, o `FunilDashboard` atual, sem mudanças.
- Novo hook `usePosVendaOverview(start, end)`, só leitura, filtrado por `POS_VENDA_ORIGIN_ID`:
  - Entraram: `crm_cliente_timeline`/`deal_activities` de entrada em `POS_VENDA_NOVOS_LICENCIADOS_STAGE_ID` no período, mais os cards criados nessa etapa.
  - Trabalhados: `calls.duration_seconds > 60` por `deal_id`, mais as atividades `pos_venda_nota_contato`/WhatsApp/reunião em `deal_activities`.
  - Sem toque: etapa atual = Novos licenciados e sem `custom_fields.pos_venda_destino`.
  - Avançados: `deal_activities.activity_type='pos_venda_envio'` no período.
  - Abertos: etapa Viabilidade 1 sem nota e sem linhas em `crm_deal_entregaveis`.
  - Parados: sem nenhuma linha em `deal_activities`/`calls`. Envelhecidos: último contato há mais de 15 dias.
  - Reuniões: `meeting_slots` de deals Pós Venda (closers `bu='pos_venda'`), por status (scheduled/completed/no_show/rescheduled); viabilidades concluídas = entrada na etapa `POS_VENDA_CONCLUIDA_STAGE_ID` no período.
  - Agrupamento por `crm_deals.owner_id`, com nome vindo de `profiles`.
- Novo componente `PosVendaGerenteTable`. Sem migrações, gatilhos, RPCs nem alteração de dados.
