# Mover "Últimas atividades" para a aba Logs

Hoje o painel de status (topo de `/admin/automacoes`) mostra 3 cards + uma lista das 8 últimas tentativas. O usuário quer essa lista **apenas** dentro da aba **Logs**.

## Mudança

- `src/components/automations/AutomationStatusPanel.tsx`
  - Remover o `<Card>` "Últimas atividades" e o hook `useRecentActivity`.
  - Manter os 3 cards (Pendentes / Concluídos / Com erro) e o indicador "live".
  - Remover imports não usados (`Badge`, ícones de canal/status e `formatDistanceToNow`).

- `src/components/automations/AutomationLogs.tsx`
  - Acrescentar no topo um bloco compacto **"Últimas atividades (auto-atualiza)"** com as 8 entradas mais recentes (mesma UI removida do painel), antes da tabela/filtros existentes.
  - Reaproveitar a query realtime via `useAutomationRealtime` para refrescar a lista.

## Sem mudanças

- Nenhuma migration, nenhuma edge function.
- Cards de Pendentes/Concluídos/Com erro continuam no painel.
