

# Plano: Corrigir Lista de Closers e Horários no Consórcio

## Problemas Identificados

### Problema 1: Dropdown de Usuários Vazio/Inconsistente

O Select de usuários no `CloserFormDialog` está usando `formData.employee_id` como valor, mas:
- `handleUserSelect` recebe `userId` (que é o `profiles.id`, não o `employee_id`)
- A query busca usuários onde `employees.id` seria o valor correto, mas nenhum usuário tem registro na tabela `employees` (todos retornam `employee_id: null`)
- O Select não consegue selecionar o usuário porque o `value` do SelectItem é `user.id` (profile ID), mas o Select espera `formData.employee_id` que não corresponde

**Solução**: Usar `user.id` (profile ID) como identificador interno para a seleção E guardar separadamente o `employee_id` real quando existir.

### Problema 2: Horários Não Aparecem na Agenda

O hook `useUniqueSlotsForDays` recebe `closerIdsForSlots` como filtro. Os closers do Consórcio são:
- João Pedro: tem 1 horário configurado (Segunda às 09:00)
- Victoria Paz: não tem horários configurados

Porém, se a lista de closers está vazia ou os IDs não batem, nenhum slot aparece.

**Verificação feita**: O banco confirma que João Pedro TEM horário na Segunda-feira às 09:00. O problema pode estar na forma como o componente passa os IDs.

---

## Correções Necessárias

### 1. Corrigir CloserFormDialog - Select de Usuários

O problema está no mismatch de valores:
- SelectItem usa `user.id` (profile ID) como value
- Select compara com `formData.employee_id` (que é diferente ou null)

**Solução**: Criar um estado separado `selectedUserId` para controlar a seleção, e manter `employee_id` apenas para o submit.

```typescript
// Adicionar estado para o usuário selecionado
const [selectedUserId, setSelectedUserId] = useState<string>('');

const handleUserSelect = (userId: string) => {
  setSelectedUserId(userId);
  const user = closerUsers.find(u => u.id === userId);
  if (user) {
    const employeeId = user.employees?.[0]?.id || null;
    setFormData({
      ...formData,
      name: user.full_name || '',
      email: user.email || '',
      employee_id: employeeId || undefined,
      bu: user.squad || 'incorporador',
    });
  }
};

// No Select, usar selectedUserId ao invés de formData.employee_id
<Select
  value={selectedUserId}
  onValueChange={handleUserSelect}
>
```

### 2. Verificar/Corrigir Query de useCloserCrossBUConflicts

O hook `useCloserCrossBUConflicts` pode estar causando problemas se os closers não tiverem `employee_id` configurado.

Quando `employee_id` é null para todos os closers, a query retorna conjunto vazio corretamente, mas precisamos garantir que isso não afete outros hooks.

### 3. Garantir Invalidação de Cache

Após adicionar horários no modal "Configurar Closers", garantir que o cache seja invalidado corretamente para que os slots apareçam imediatamente.

---

## Alterações por Arquivo

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/CloserFormDialog.tsx` | Adicionar `selectedUserId` estado para controlar o Select corretamente |
| `src/hooks/useCloserConflicts.ts` | Verificar tratamento de closers sem `employee_id` |

---

## Fluxo Esperado Após Correção

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Abrir Modal "Adicionar Closer"                                     │
│  1. Query busca usuários com role closer/closer_sombra              │
│  2. Lista aparece com: João Pedro, Victoria Paz, etc.               │
│  3. Usuário seleciona "João Pedro"                                  │
│  4. selectedUserId = "8e66266d-..." (profile ID)                    │
│  5. employee_id = null (porque não tem registro em employees)       │
│  6. Nome/Email preenchidos automaticamente                          │
│  7. Ao salvar: closer criado com employee_id = null (OK)            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Agenda Consórcio                                                   │
│  1. useClosersWithAvailability('consorcio') retorna 2 closers       │
│  2. closerIdsForSlots = ['4e3eabf5-...', '412f87de-...']            │
│  3. useUniqueSlotsForDays filtra por esses IDs                      │
│  4. João Pedro tem Segunda 09:00 → aparece no calendário           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Observação: Cadastro Multi-BU

Para cadastrar usuários que atuam em múltiplas BUs (como Luis ou Thobson):

1. **Cadastrar normalmente** no CRM de cada BU através de Configurações → Closers
2. Se o usuário tiver registro na tabela `employees`, o sistema vai vincular automaticamente via `employee_id`
3. Se não tiver registro em `employees`, os registros serão independentes (sem sincronização de agenda entre BUs)

Para habilitar a sincronização cross-BU:
- O usuário precisa ter um registro na tabela `employees`
- Todos os registros de closer desse usuário em diferentes BUs devem ter o mesmo `employee_id`
- Atualmente, como nenhum closer tem `employee_id` preenchido, a funcionalidade de sincronização está inativa

