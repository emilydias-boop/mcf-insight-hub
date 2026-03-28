

## Adicionar filtro de período na lista de Próximas Ações

### Problema
Todas as ações pendentes aparecem acumuladas sem filtro. Com o tempo, a lista fica poluída com ações futuras que não são relevantes agora.

### Solução

#### 1. `src/components/sdr/PendingActionsPanel.tsx`
- Adicionar estado `dateFilter` com opções: `'hoje'` (default), `'semana'`, `'mes'`, `'todas'`
- Renderizar botões de filtro (estilo toggle, como já existe em `DealTasksSection`) abaixo do header
- Filtrar `actions` no client-side antes de renderizar:
  - **Hoje**: `isToday || isOverdue` (atrasadas sempre aparecem)
  - **Semana**: ação dentro dos próximos 7 dias + atrasadas
  - **Mês**: ação dentro dos próximos 30 dias + atrasadas
  - **Todas**: sem filtro
- Atualizar contadores (total badge) para refletir o filtro ativo
- Atrasadas (`isOverdue`) sempre visíveis em qualquer filtro — nunca escondidas
- Default "Hoje" mantém a tela limpa e focada

#### 2. Layout dos filtros
- 4 botões pequenos em linha: `Hoje | Semana | Mês | Todas`
- Usar `Button variant="secondary"` para ativo e `variant="ghost"` para inativo (mesmo padrão do DealTasksSection)
- Posicionados entre o header e a lista de ações

### Arquivo alterado
- `src/components/sdr/PendingActionsPanel.tsx`

