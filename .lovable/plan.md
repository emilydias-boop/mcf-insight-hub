

## Plano: Restringir "Visão Diretor" e "Relatórios" a roles de gestão

### Problema

Ao migrar de `RoleGuard` para `ResourceGuard`, páginas de gestão como "Visão Diretor" (`/dashboard`) e "Relatórios" (`/relatorios`) ficaram acessíveis a qualquer role que tenha `dashboard: view` ou `relatorios: view` — incluindo `assistente_administrativo`, `marketing`, `viewer`, etc. Essas páginas são de **nível diretoria/gestão** e não devem aparecer para cargos operacionais.

### Solução

Usar `RoleGuard` para páginas que são intrinsecamente de gestão, e manter `ResourceGuard` apenas para páginas que realmente devem ser controladas pelo banco.

| Página | Antes (atual) | Depois |
|--------|---------------|--------|
| Visão Diretor (`/dashboard`) | `ResourceGuard resource="dashboard"` | `RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}` |
| Relatórios global (`/relatorios`) | `ResourceGuard resource="relatorios"` | `RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}` |
| Relatórios leads-sem-tag | `ResourceGuard resource="relatorios"` | `RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}` |

### Sidebar

Na sidebar (`AppSidebar.tsx`), o item "Visão Diretor" atualmente usa `resource: "dashboard"`. Trocar para `requiredRoles: ["admin", "manager", "coordenador"]` para que não apareça no menu de roles operacionais.

O item "Relatórios" global também precisa do mesmo tratamento.

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Linhas 186, 202-203: trocar `ResourceGuard` por `RoleGuard` nas 3 rotas |
| `src/components/layout/AppSidebar.tsx` | Item "Visão Diretor": trocar `resource: "dashboard"` por `requiredRoles: ["admin", "manager", "coordenador"]`. Idem para item "Relatórios" global |

### O que NÃO muda
- BU-specific relatórios (consórcio, crédito, projetos, etc.) continuam com `ResourceGuard resource="relatorios"` — controlados pelo banco
- Chairman continua com `RoleGuard ['admin', 'manager']`
- Todas as outras rotas ResourceGuard permanecem iguais

### Resultado
- Roles operacionais (sdr, closer, assistente, marketing, viewer) não verão "Visão Diretor" nem "Relatórios" global
- BU relatórios continuam acessíveis conforme permissões do banco
- O admin continua controlando acesso a BU pages via `/admin/permissoes`

