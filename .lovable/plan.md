

## Plano: Ocultar funcionalidade de Atendimentos

Remover a aba "Atendimentos" da navegação e o widget/drawer flutuante de conversas, mantendo todo o código intacto para reativação futura.

### 1. `src/pages/CRM.tsx` — Remover item de navegação
- Remover/comentar o item `{ to: '/crm/atendimentos', label: 'Atendimentos', icon: MessageCircle }` do array `allNavItems`

### 2. `src/pages/crm/BUCRMLayout.tsx` — Remover de todas as BUs
- Remover `'atendimentos'` de todos os arrays em `BU_VISIBLE_TABS` (incorporador, consorcio, credito, projetos, leilao)
- Remover o item `{ key: 'atendimentos', ... }` do array de tabs

### 3. `src/components/layout/MainLayout.tsx` — Desabilitar widget e drawer
- Setar `ENABLE_CONVERSATIONS_WIDGET = false` ou remover/comentar as linhas do `ConversationsFloatingWidget` e `ConversationsDrawer`

### 4. Rotas mantidas
- As rotas em `App.tsx` serão mantidas (apenas não acessíveis pela UI), para não quebrar nada caso alguém acesse diretamente

