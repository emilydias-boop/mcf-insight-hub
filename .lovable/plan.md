
# Plano: Corrigir Query de Usuários que Retorna Vazia

## Problema Identificado

A query no `CloserFormDialog` está retornando **Status 400** porque a sintaxe de foreign key hint não está funcionando:

```
employees!employees_user_id_fkey(id)
```

Erro retornado:
```
"Could not find a relationship between 'profiles' and 'employees' in the schema cache"
```

Isso faz com que **nenhum usuário apareça no dropdown**, pois a query falha silenciosamente.

---

## Causa Raiz

- A tabela `employees` existe, mas não há uma **foreign key formal** entre `employees.user_id` e `profiles.id` reconhecida pelo PostgREST
- Sem essa FK, a sintaxe `employees!fk_name(...)` não funciona
- A query do Supabase client retorna erro 400 e o React Query armazena array vazio

---

## Solução: Simplificar a Query

Em vez de tentar fazer join via FK que não existe, vamos:

1. **Remover a parte de `employees` da query principal** - buscar apenas os perfis
2. **Se necessário**, buscar `employee_id` separadamente quando o usuário for selecionado

### Query Simplificada:

```typescript
const { data: closerUsers = [], isLoading: loadingUsers } = useQuery({
  queryKey: ['all-users-for-closer'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, squad')
      .not('full_name', 'is', null)
      .order('full_name');
    
    if (error) throw error;
    return data || [];
  },
  enabled: open && !isEditing,
});
```

### Buscar Employee ID ao Selecionar Usuário:

```typescript
const handleUserSelect = async (userId: string) => {
  setSelectedUserId(userId);
  const user = closerUsers.find(u => u.id === userId);
  if (user) {
    // Buscar employee_id separadamente se necessário
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    
    setFormData({
      ...formData,
      name: user.full_name || '',
      email: user.email || '',
      employee_id: emp?.id || undefined,
      bu: user.squad || 'incorporador',
    });
  }
};
```

---

## Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/CloserFormDialog.tsx` | Remover join com employees na query, buscar employee_id on-demand |

---

## Resultado Esperado

| Estado Atual | Após Correção |
|-------------|---------------|
| Query retorna erro 400 | Query retorna todos os perfis |
| Dropdown vazio | Dropdown com todos os usuários (Thobson, Luis, etc.) |
| Não consegue cadastrar closer | Consegue cadastrar qualquer usuário como closer |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Admin abre "Adicionar Closer"                                      │
│  1. Query busca profiles (sem join): SELECT id, full_name, email    │
│  2. Retorna 35+ usuários (todos do sistema)                         │
│  3. Dropdown mostra: Thobson, Luis Felipe, Jessica, etc.            │
│  4. Admin seleciona "Thobson"                                       │
│  5. Sistema busca employee_id via query separada (se existir)       │
│  6. Formulário preenchido, pronto para salvar                       │
└─────────────────────────────────────────────────────────────────────┘
```
