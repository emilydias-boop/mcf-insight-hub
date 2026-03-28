

## Aprimorar "Próxima Ação" — alerta no card + painel no SDR

### Visão geral

Três mudanças principais:

1. **Alerta visual no DealKanbanCard** — badge pulsante mostrando a próxima ação (tipo + data). Se atrasada, fica vermelho com animação. Visível para todos os roles.

2. **Painel "Minhas Próximas Ações" na página Minhas Reuniões** — lista dedicada com as ações pendentes do SDR, ordenadas por urgência (atrasadas primeiro). Com botões para executar a ação (ligar/whatsapp/email). Apenas para o SDR dono.

3. **Hook `usePendingNextActions`** — busca deals do SDR logado que tenham `next_action_date` preenchido, ordenados por data.

### Detalhes técnicos

#### 1. `src/hooks/usePendingNextActions.ts` (novo)

Query que busca `crm_deals` do usuário logado com `next_action_type IS NOT NULL`, join com `crm_contacts` para nome/telefone/email. Retorna lista ordenada por `next_action_date ASC` (atrasadas primeiro). Campos: `dealId`, `dealName`, `contactPhone`, `actionType`, `actionDate`, `actionNote`, `isOverdue`.

#### 2. `src/components/crm/DealKanbanCard.tsx`

Adicionar na Linha 2 (entre badges e nome do lead) um indicador de próxima ação:
- Se `deal.next_action_type` existe: badge com icone do tipo + data formatada (ex: "📞 28/03 14:00")
- Se `deal.next_action_date < now`: badge vermelho pulsante com `animate-pulse` + texto "⚠️ Atrasada"
- Se não tem próxima ação: nada

#### 3. `src/components/sdr/PendingActionsPanel.tsx` (novo)

Componente que exibe lista de ações pendentes do SDR:
- Header com contagem total + atrasadas (badge vermelho pulsante)
- Cada item mostra: tipo (icone), nome do lead, data/hora, nota, status (atrasada/hoje/futura)
- Botão de ação rápida (ligar via Twilio, abrir WhatsApp, email)
- Botão "Concluir" que limpa a próxima ação do deal
- Itens atrasados ficam com borda vermelha e fundo vermelho/5
- Itens de hoje ficam com borda amarela
- Sons/animação: atrasadas pulsam, hoje tem destaque amarelo

#### 4. `src/pages/sdr/MinhasReunioes.tsx`

Inserir `<PendingActionsPanel />` logo após o header (antes dos Summary Cards, ~linha 229). Fica no topo para "fazer barulho" — o SDR vê as ações pendentes assim que abre a página.

### Regras de visibilidade

- **Card Kanban (todos os roles)**: badge visual de próxima ação + indicador de atraso
- **Painel de ações (apenas SDR)**: lista interativa com botões de execução na página "Minhas Reuniões"

### Arquivos alterados/criados
- `src/hooks/usePendingNextActions.ts` (novo)
- `src/components/sdr/PendingActionsPanel.tsx` (novo)
- `src/components/crm/DealKanbanCard.tsx` (adicionar badge de próxima ação)
- `src/pages/sdr/MinhasReunioes.tsx` (inserir PendingActionsPanel)

