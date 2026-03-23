

## Plano: Adicionar exclusão de colaboradores na página de RH

### Problema

Não existe funcionalidade de excluir colaboradores (employees) na página de Colaboradores. Não há `deleteEmployee` no hook `useEmployeeMutations` e nenhum botão de exclusão na tabela ou no drawer.

### Correção

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useEmployees.ts` | Adicionar mutation `deleteEmployee` que deleta da tabela `employees` por ID |
| `src/pages/rh/Colaboradores.tsx` | Adicionar coluna de ações com botão de excluir (ícone lixeira) e dialog de confirmação |

### Detalhes

1. **Hook** (`useEmployees.ts`): Adicionar no `useEmployeeMutations`:
```typescript
const deleteEmployee = useMutation({
  mutationFn: async (id: string) => {
    // Deletar dependências primeiro (documents, events, notes, nfse)
    await supabase.from('employee_documents').delete().eq('employee_id', id);
    await supabase.from('employee_events').delete().eq('employee_id', id);
    await supabase.from('employee_notes').delete().eq('employee_id', id);
    await supabase.from('rh_nfse').delete().eq('employee_id', id);
    // Deletar employee
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;
  },
  onSuccess: () => { invalidate; toast.success('Colaborador excluído'); },
});
```

2. **Página** (`Colaboradores.tsx`):
   - Adicionar coluna "Ações" na tabela com botão de lixeira (ícone `Trash2`)
   - `AlertDialog` de confirmação antes de excluir (mostra nome do colaborador)
   - O clique no botão de excluir usa `e.stopPropagation()` para não abrir o drawer

### Resultado
- Admin poderá excluir colaboradores duplicados diretamente da tabela
- Confirmação obrigatória antes da exclusão para evitar acidentes

