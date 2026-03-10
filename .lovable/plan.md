

## Renomear "Gerentes de Conta" → "Gerentes de Relacionamento" + Verificação do plano

### Status do Módulo GR

O módulo está **funcionalmente completo** com todas as features implementadas:

| Feature | Status |
|---------|--------|
| Minha Carteira (visão do GR) | Implementado |
| Gestão de Carteiras (admin) | Implementado |
| Detalhe do GR (6 abas: Performance, Parceiros, Agenda, Histórico, Financeiro, Auditoria) | Implementado |
| Drawer de entrada (timeline, ações, status) | Implementado |
| Distribuição automática/manual | Implementado |
| Transferência entre carteiras | Implementado |
| Capacidade e redistribuição | Implementado |
| Sincronização bidirecional com CRM | Implementado (triggers/RPC) |

### O que falta: Renomear para "Gerentes de Relacionamento"

Todas as referências textuais "Gerentes de Conta" / "Gerente de Conta" precisam ser atualizadas em **7 arquivos**:

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `src/components/layout/AppSidebar.tsx` | Título da seção: "Gerentes de Conta" → "Gerentes de Relacionamento" |
| 2 | `src/pages/gerentes-conta/GestaoCarteiras.tsx` | Título e subtítulo da página |
| 3 | `src/pages/gerentes-conta/GRDetail.tsx` | Textos "Voltar para Gestão" |
| 4 | `src/components/gr/GRDetailHeader.tsx` | Fallback name "Gerente de Conta" → "Gerente de Relacionamento" |
| 5 | `src/components/gr/CreateGRWalletDialog.tsx` | Label "Gerente de Conta" → "Gerente de Relacionamento" |
| 6 | `src/types/gr-types.ts` | Comentário do módulo |
| 7 | `src/App.tsx` | Comentário de seção |

As rotas (`/gerentes-conta/...`) e nomes de arquivos/pastas permanecem iguais para evitar quebras - apenas os textos visíveis ao usuário mudam.

