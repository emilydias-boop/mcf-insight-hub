

## Entendi a sua ideia

Hoje a matriz de permissões é **global por cargo** — um SDR tem as mesmas permissões independente de estar no Consórcio ou no Incorporador. Mas faz mais sentido que as permissões sejam **por cargo + por BU**, porque um SDR de Consórcio pode precisar ver coisas diferentes de um SDR de Leilão.

## Proposta: Permissões por Cargo separadas por BU

### Como ficaria a interface

1. **Seletor de BU no topo** da página — abas ou dropdown (Incorporador, Consórcio, Crédito, Leilão, Global)
2. **Aba "Global"** — permissões que valem para todos (Dashboard, Relatórios, Configurações, Gestão de Usuários)
3. **Aba por BU** — permissões específicas daquela unidade (CRM, Fechamento Equipe, módulos específicos)
4. A mesma matriz (Recurso x Cargo), mas filtrada pelo contexto da BU selecionada

### Mudanças no banco de dados

Adicionar coluna `bu` (nullable) na tabela `role_permissions`:

```sql
ALTER TABLE role_permissions ADD COLUMN bu TEXT DEFAULT NULL;
-- NULL = permissão global (vale para todas as BUs)
-- 'incorporador', 'consorcio', 'credito', 'leilao' = específica da BU

-- Atualizar constraint unique para incluir bu
DROP INDEX IF EXISTS role_permissions_role_resource_key;
CREATE UNIQUE INDEX role_permissions_role_resource_bu_key 
  ON role_permissions (role, resource, COALESCE(bu, '__global__'));
```

### Mudanças na lógica de verificação (`useMyPermissions`)

```typescript
// Ao verificar acesso, considerar:
// 1. Permissão global (bu = null) do cargo
// 2. Permissão específica da BU ativa (bu = 'consorcio')
// A mais específica (BU) sobrescreve a global
```

### Mudanças na UI (`Permissoes.tsx`)

- Adicionar **Tabs** no topo: Global | Incorporador | Consórcio | Crédito | Leilão
- Filtrar recursos relevantes por aba (ex: na aba Consórcio, mostrar CRM, Fechamento, etc.)
- Ao salvar, incluir o campo `bu` nos upserts
- Recursos globais (Dashboard, Configurações, Usuários) aparecem apenas na aba "Global"

### Classificação dos recursos

| Recurso | Contexto |
|---------|----------|
| Dashboard, Relatórios, Configurações, Gestão de Usuários, Alertas | Global |
| CRM, Fechamento Equipe, Efeito Alavanca | Por BU |
| Financeiro (Receita/Custos), Módulo Financeiro | Global |
| Projetos, Crédito, Leilão | Por BU (respectiva) |

### Arquivos a modificar

- **Migration SQL** — adicionar coluna `bu` + novo unique index
- `src/pages/admin/Permissoes.tsx` — adicionar tabs de BU, filtrar recursos, passar `bu` no save
- `src/hooks/useRolePermissions.ts` — incluir `bu` nas queries e upserts
- `src/hooks/useMyPermissions.ts` — verificar permissão global + BU ativa (usa `useActiveBU`)

