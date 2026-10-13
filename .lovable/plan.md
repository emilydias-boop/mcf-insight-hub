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

## 4. Dica em cada indicador
- Cada número (Entraram, Já trabalhados, Sem toque, Avançados, Abertos, Parados, Envelhecidos, Tempo médio e as colunas de reuniões) ganha um ícone "i". Ao passar o mouse ou tocar, aparece de onde vem o dado. Exemplo: "Ligações com mais de 60 segundos, notas de contato e mensagens registradas no card, no período escolhido."

## 5. Botão "Visão por gerente"
Ao lado do seletor de período. Mostra uma tabela com uma linha por gerente de relacionamento, com:
- Os indicadores acima, por gerente (dono do card).
- Reuniões tiradas **só da "Agenda de Reuniões — Viabilidade"** (a mesma tela do botão Agenda), pelo gerente marcado na reunião e pela data da reunião: **agendadas, realizadas, no-show, reagendamentos** e **viabilidades concluídas**.
- Uma linha de total no fim.
- Conferência feita agora na semana de 12/10 a 18/10/2026: William Rangel tem 7 reuniões (6 agendadas e 1 realizada) e Rebeca Saar tem 1 agendada. A tabela vai mostrar exatamente esses números nesse período.

## Pontos para você confirmar
- A agenda hoje só tem os status Agendada, Realizada, No-show e Cancelada. Não existe "Reagendada". Proposta: contar como **reagendamento** a reunião cancelada do mesmo cliente que ganhou uma reunião nova depois. Se preferir, posso criar a opção "Reagendada" na agenda, mas isso muda a tela da agenda.
- **Viabilidades concluídas** = cards que o gerente levou para "Viabilidade Concluída" no período (a agenda não tem esse status).
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
  - Reuniões: somente `pos_venda_reunioes` (fonte da AgendaPosVenda), agrupadas por `gerente_id` e filtradas por `inicio` no fuso America/Sao_Paulo; status agendada/realizada/no_show; reagendamento = `cancelada` com outra reunião posterior do mesmo `deal_id`. Não usa `meeting_slots`. Viabilidades concluídas = entrada na etapa `POS_VENDA_CONCLUIDA_STAGE_ID` no período.
  - Dicas: componente `Tooltip` do shadcn com texto fixo por indicador.
  - Agrupamento por `crm_deals.owner_id`, com nome vindo de `profiles`.
- Novo componente `PosVendaGerenteTable`. Sem migrações, gatilhos, RPCs nem alteração de dados.
