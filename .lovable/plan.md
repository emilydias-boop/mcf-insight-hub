
# Plano: Centralizar Permissões de Acesso R2 no Sistema de Usuários

## Situacao Atual

O sistema tem dois caminhos separados para controlar acesso:

1. **Sistema de Permissoes por Usuario** - Existe na tela Gerenciamento de Usuarios, aba Permissoes. Controla acesso a modulos como CRM, Dashboard, etc.

2. **Acesso Agenda R2** - Sistema separado com:
   - Roles automaticos (admin, manager, coordenador)
   - Whitelist hardcoded no codigo (`R2_AUTHORIZED_USERS`)
   - Tabela `closers` com `meeting_type = 'r2'`

Isso causa confusao porque nao ha um lugar unico para gerenciar todas as permissoes.

## Solucao Proposta

Unificar o acesso a Agenda R2 no sistema existente de `user_permissions`, permitindo que voce controle o acesso de qualquer usuario diretamente na aba de Permissoes.

```text
Fluxo apos implementacao:

  Admin Usuarios               Drawer do Usuario         Aba Permissoes
  ┌─────────────┐              ┌────────────────┐        ┌─────────────────────┐
  │ Mateus      │  ──click──>  │ Geral          │        │ CRM: Visualizar     │
  │ Macedo      │              │ Seguranca      │        │ Dashboard: Nenhum   │
  │             │              │ Permissoes  <──│────>   │ Agenda R2: Completo │  <-- NOVO
  └─────────────┘              │ Integracoes    │        │ ...                 │
                               └────────────────┘        └─────────────────────┘
```

## Etapas de Implementacao

### Etapa 1: Adicionar "agenda_r2" ao enum do banco

Executar migracao SQL para adicionar o novo valor ao enum `resource_type`:

```sql
ALTER TYPE resource_type ADD VALUE 'agenda_r2';
```

### Etapa 2: Atualizar labels no frontend

Arquivo: `src/types/user-management.ts`

Adicionar label para o novo recurso:

```typescript
export const RESOURCE_LABELS: Record<ResourceType, string> = {
  // ... recursos existentes
  agenda_r2: "Agenda R2",  // NOVO
};
```

### Etapa 3: Adicionar "Agenda R2" na UI de Permissoes

Arquivo: `src/components/user-management/UserDetailsDrawer.tsx`

Adicionar o recurso na lista e nos grupos:

```typescript
const allResources: ResourceType[] = [
  // ... existentes
  'agenda_r2',  // NOVO
];

const resourceGroups = {
  // ... grupos existentes
  'CRM': ['crm', 'agenda_r2'] as ResourceType[],  // ADICIONAR AQUI
};
```

### Etapa 4: Atualizar R2AccessGuard para verificar user_permissions

Arquivo: `src/components/auth/R2AccessGuard.tsx`

Modificar para consultar `user_permissions` como fonte adicional de acesso:

```typescript
// Adicionar hook para verificar permissao
const { data: r2Permission } = useQuery({
  queryKey: ['user-r2-permission', user?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('user_permissions')
      .select('permission_level')
      .eq('user_id', user.id)
      .eq('resource', 'agenda_r2')
      .maybeSingle();
    return data;
  },
  enabled: !!user?.id,
});

// Adicionar na logica de verificacao
const hasUserPermission = r2Permission?.permission_level && 
  r2Permission.permission_level !== 'none';

// Acesso = role permitido OU whitelist OU closer R2 OU user_permission
if (!hasRoleAccess && !hasUserAccess && !hasCloserAccess && !hasUserPermission) {
  // negar acesso
}
```

### Etapa 5 (Opcional): Remover whitelist hardcoded

Apos migrar os usuarios da whitelist para `user_permissions`, remover o array `R2_AUTHORIZED_USERS` do codigo.

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| Migracao SQL | Adicionar `agenda_r2` ao enum `resource_type` |
| `src/types/user-management.ts` | Adicionar label "Agenda R2" |
| `src/components/user-management/UserDetailsDrawer.tsx` | Incluir `agenda_r2` na lista de recursos |
| `src/components/auth/R2AccessGuard.tsx` | Verificar `user_permissions` para acesso R2 |

## Resultado Final

Apos a implementacao, para dar acesso ao Mateus Macedo (ou qualquer usuario):

1. Ir em **Gerenciamento de Usuarios**
2. Clicar em **Mateus Macedo** → **Gerenciar**
3. Ir na aba **Permissoes**
4. Definir **Agenda R2** como **Visualizar** ou **Completo**
5. Clicar em **Salvar Permissoes**

O Mateus tera acesso imediato a Agenda R2, sem precisar alterar codigo ou pedir ajuda.

## Beneficios

- Gestao centralizada de todas as permissoes em um unico lugar
- Self-service para o admin (voce)
- Auditoria: todas as permissoes ficam registradas no banco
- Escalavel: facil adicionar novos recursos no futuro (ex: agenda_r1, relatorios_financeiros, etc.)
- Elimina whitelists hardcoded no codigo
