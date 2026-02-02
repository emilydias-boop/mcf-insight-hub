

# Plano: Selecionar Closers de Usuários Existentes

## Problema Atual

O formulário de Closer atual usa inputs manuais para nome e email, o que permite criar closers que não existem como usuários no sistema. Isso pode gerar inconsistências.

## Solução

Modificar o `CloserFormDialog` para exibir um **dropdown de usuários existentes** com role "closer" (e opcionalmente "closer_sombra"), pré-preenchendo automaticamente nome, email e vinculando o `employee_id`.

---

## Alterações no Arquivo

**Arquivo:** `src/components/crm/CloserFormDialog.tsx`

### 1. Adicionar Query para Buscar Usuários com Role Closer

```typescript
// Buscar usuários com role 'closer' ou 'closer_sombra'
const { data: closerUsers = [], isLoading: loadingUsers } = useQuery({
  queryKey: ['users-with-closer-role'],
  queryFn: async () => {
    const { data } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        squad,
        user_roles!inner(role)
      `)
      .in('user_roles.role', ['closer', 'closer_sombra'])
      .order('full_name');
    return data || [];
  },
  enabled: open && !isEditing, // Só buscar ao criar novo
});
```

### 2. Adicionar Dropdown de Seleção de Usuário (modo criação)

```typescript
{/* Seleção de Usuário - Apenas no modo criação */}
{!isEditing && (
  <div className="space-y-2">
    <Label>Selecionar Usuário *</Label>
    <Select
      value={formData.employee_id || ''}
      onValueChange={(userId) => {
        const user = closerUsers.find(u => u.id === userId);
        if (user) {
          setFormData({
            ...formData,
            name: user.full_name || '',
            email: user.email || '',
            employee_id: user.id,
            bu: user.squad || 'incorporador',
          });
        }
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecione um usuário com cargo Closer..." />
      </SelectTrigger>
      <SelectContent>
        {closerUsers.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.full_name} ({user.email})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground">
      Apenas usuários com cargo "Closer" ou "Closer Sombra" aparecem aqui
    </p>
  </div>
)}
```

### 3. Campos de Nome/Email em Read-Only (modo criação)

No modo criação, após selecionar um usuário, os campos nome/email ficam em modo leitura:

```typescript
<Input
  id="name"
  value={formData.name}
  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
  placeholder="Nome do closer"
  required
  disabled={!isEditing && !!formData.employee_id} // Read-only se selecionou usuário
/>
```

---

## Fluxo de Uso

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Botão "Adicionar Closer"                                           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Modal abre                                                         │
│  Dropdown: "Selecione um usuário com cargo Closer..."              │
│                                                                     │
│  [ João Pedro Martins Vieira (joao.pedro@minhacasa...) ]           │
│  [ Jessica Martins (jessica.martins@minhacasa...) ]                │
│  [ Cristiane Gomes (cristiane.gomes@minhacasa...) ]                │
│  [ ... ]                                                           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Usuário selecionado: João Pedro                                   │
│                                                                     │
│  Nome: [João Pedro Martins Vieira] (readonly)                      │
│  Email: [joao.pedro@minhacasa...] (readonly)                       │
│  BU: [Consórcio] (auto-preenchido com squad do usuário)           │
│  Cor: [●] Selecionável                                             │
│  Calendly: [...] Configurável                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Benefícios

1. **Evita duplicatas**: Não é possível criar closers que não existem como usuários
2. **Vincula automaticamente**: `employee_id` é preenchido com o ID do perfil
3. **BU auto-detectada**: Usa o `squad` do usuário como BU padrão
4. **Consistência**: Nome e email vêm diretamente do cadastro do usuário

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/CloserFormDialog.tsx` | Adicionar query de usuários com role closer, dropdown de seleção, vincular employee_id |
| `src/hooks/useClosers.ts` | Adicionar `employee_id` ao insert se fornecido |

---

## Consideração Importante

Os 4 closers mencionados para o Consórcio têm as seguintes roles no sistema:

| Nome | Role Atual | Squad |
|------|------------|-------|
| João Pedro | closer ✓ | consorcio |
| Luis Felipe | manager | consorcio |
| Thobson | coordenador | consorcio |
| Victoria Paz | closer_sombra | incorporador |

Se quiser que Luis Felipe e Thobson apareçam no dropdown, será necessário atribuir a eles o cargo "closer" ou "closer_sombra" no Admin → Usuários.

