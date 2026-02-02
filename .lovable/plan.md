

# Plano: Corrigir Vinculação do Employee ID

## Problema Identificado

O erro **"violates foreign key constraint closers_employee_id_fkey"** ocorre porque:

| Campo | Esperado | Estava Passando |
|-------|----------|-----------------|
| `closers.employee_id` | ID da tabela `employees` | ID da tabela `profiles` |

A relação correta é:
```text
closers.employee_id → employees.id
employees.user_id → profiles.id (auth.users)
```

---

## Solução

Modificar a query que busca usuários para também trazer o `employees.id` correspondente, e usar esse ID ao invés do `profiles.id`.

---

## Alteração no Arquivo

**Arquivo:** `src/components/crm/CloserFormDialog.tsx`

### Modificar Query para Incluir Employee ID

```typescript
// Buscar usuários com role 'closer' ou 'closer_sombra' E seu employee_id
const { data: closerUsers = [], isLoading: loadingUsers } = useQuery({
  queryKey: ['users-with-closer-role'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        squad,
        user_roles!inner(role),
        employees!employees_user_id_fkey(id)
      `)
      .in('user_roles.role', ['closer', 'closer_sombra'])
      .order('full_name');
    
    if (error) throw error;
    return (data || []);
  },
  enabled: open && !isEditing,
});
```

### Modificar Função handleUserSelect

```typescript
const handleUserSelect = (userId: string) => {
  const user = closerUsers.find(u => u.id === userId);
  if (user) {
    // Pegar o employee_id do primeiro registro de employees
    const employeeId = user.employees?.[0]?.id || null;
    
    setFormData({
      ...formData,
      name: user.full_name || '',
      email: user.email || '',
      employee_id: employeeId, // Usar employees.id, não profiles.id
      bu: user.squad || 'incorporador',
    });
  }
};
```

### Atualizar Interface

```typescript
interface CloserUser {
  id: string;
  full_name: string | null;
  email: string | null;
  squad: string | null;
  employees?: { id: string }[];
}
```

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│  profiles.id          employees.id          closers.employee_id     │
│  (auth.users)         (funcionário)         (vinculação)            │
│                                                                     │
│  João Pedro  ───────►  abc-123-def  ───────►  abc-123-def          │
│  (profile_id)          (employee_id)         (saved!)              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Consideração

Se um usuário **não tiver registro na tabela `employees`**, o `employee_id` será `null`, permitindo criar o closer mesmo assim. Isso é compatível com a estrutura atual onde `employee_id` é nullable.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/CloserFormDialog.tsx` | Buscar `employees.id` via join e usar no `employee_id` |

