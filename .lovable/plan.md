

## Plano: Corrigir acesso negado para roles criadas pelo admin

### Diagnóstico

O sistema tem **dois mecanismos de controle de acesso paralelos e inconsistentes**:

1. **`RoleGuard`** (hardcoded) — usado em ~40 rotas no `App.tsx` com listas fixas como `['admin', 'manager', 'coordenador']`. Qualquer role nova (ex: `assistente_administrativo`, `marketing`) é bloqueada automaticamente porque não está na lista.

2. **`ResourceGuard`** (banco de dados) — usado em ~12 rotas, consulta a tabela `role_permissions`. Funciona corretamente MAS a role `assistente_administrativo` **não tem nenhuma permissão configurada** na tabela.

Resultado: o usuário `assistente_administrativo` bate em `RoleGuard` → bloqueado, ou bate em `ResourceGuard` → sem permissão no banco → bloqueado.

### Dados do banco

```text
Roles com permissões configuradas (permission_level != 'none'):
- admin: acesso total (bypass)
- manager: vários recursos
- coordenador: vários recursos
- viewer: dashboard, alertas, custos, playbook, projetos, receita, relatorios, configuracoes
- sdr: alertas, configuracoes, crm, fechamento_sdr, playbook, tv_sdr
- closer: alertas, configuracoes, crm, playbook, tv_sdr
- assistente_administrativo: NENHUMA PERMISSÃO
- marketing: NENHUMA PERMISSÃO
```

### Solução em 2 partes

#### Parte 1: Migrar rotas de RoleGuard para ResourceGuard

Trocar `RoleGuard` por `ResourceGuard` nas rotas que já possuem recurso equivalente na tabela `role_permissions`. Isso garante que qualquer role com permissão configurada no banco terá acesso.

| Rota | Antes | Depois |
|------|-------|--------|
| BU relatórios (4 rotas) | `RoleGuard ['admin','manager','coordenador']` | `ResourceGuard resource="relatorios"` |
| BU documentos estratégicos (5 rotas) | `RoleGuard ['admin','manager','coordenador']` | `ResourceGuard resource="relatorios"` |
| Consórcio index/importar/fechamento/vendas | `RoleGuard` hardcoded | `ResourceGuard resource="crm"` |
| BU Marketing | `RoleGuard ['admin','manager','coordenador']` | `ResourceGuard resource="dashboard"` (ou novo recurso `marketing`) |
| Tarefas | `RoleGuard ['admin','manager','coordenador']` | `ResourceGuard resource="configuracoes"` |

**Manter RoleGuard** apenas em:
- Admin pages (`/admin/*`) — apenas admin
- Chairman — apenas admin/manager
- Meu Fechamento — apenas sdr/closer (role-specific feature)
- CRM routes internos — sdr/closer/coordenador (operacional)

#### Parte 2: Configurar permissões para roles sem permissão

Inserir permissões na tabela `role_permissions` para `assistente_administrativo` e `marketing` com os recursos que fazem sentido:

```sql
-- assistente_administrativo: acesso de visualização a recursos administrativos
INSERT INTO role_permissions (role, resource, permission_level, bu) VALUES
('assistente_administrativo', 'dashboard', 'view', null),
('assistente_administrativo', 'configuracoes', 'view', null),
('assistente_administrativo', 'relatorios', 'view', null),
('assistente_administrativo', 'alertas', 'view', null),
('assistente_administrativo', 'playbook', 'view', null);

-- marketing: acesso a recursos de marketing
INSERT INTO role_permissions (role, resource, permission_level, bu) VALUES
('marketing', 'dashboard', 'view', null),
('marketing', 'relatorios', 'view', null),
('marketing', 'alertas', 'view', null),
('marketing', 'playbook', 'view', null);
```

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Trocar ~15 `RoleGuard` por `ResourceGuard` nas rotas listadas acima |
| `src/pages/bu-*/Relatorios.tsx` (4 arquivos) | Remover `RoleGuard`, já tratado pelo `App.tsx` ou trocar por `ResourceGuard` |
| Tabela `role_permissions` | Inserir permissões para `assistente_administrativo` e `marketing` |

### Resultado
- Qualquer role com permissão configurada no banco acessa as páginas corretas
- O admin controla tudo pela tela de permissões (`/admin/permissoes`)
- Novas roles adicionadas no futuro funcionam automaticamente (só configurar no banco)
- Routes operacionais (CRM, fechamento) mantêm RoleGuard por serem features role-specific

