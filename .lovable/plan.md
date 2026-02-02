
# Plano: Mostrar Todos Usuários no Dropdown + Adicionar Meeting Type

## Problemas Identificados

1. **Dropdown vazio**: A query filtra apenas `role IN ('closer', 'closer_sombra')`, mas:
   - Luis Felipe é `manager` → não aparece
   - Outros usuários com funções diferentes não aparecem
   
2. **Sem distinção R1/R2**: O formulário não permite selecionar se o closer faz R1 ou R2 (relevante para Incorporador)

## Alterações Necessárias

### 1. Modificar Query de Usuários para Buscar TODOS

**Arquivo:** `src/components/crm/CloserFormDialog.tsx`

Atual (linhas 87-108):
```typescript
// Buscar usuários com role 'closer' ou 'closer_sombra'
const { data: closerUsers = [] } = useQuery({
  queryKey: ['users-with-closer-role'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`...`)
      .in('user_roles.role', ['closer', 'closer_sombra'])  // ← FILTRO RESTRITIVO
```

Novo:
```typescript
// Buscar TODOS os usuários do sistema
const { data: allUsers = [] } = useQuery({
  queryKey: ['all-users-for-closer'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        squad,
        user_roles(role),
        employees!employees_user_id_fkey(id)
      `)
      .order('full_name');
    
    if (error) throw error;
    return data || [];
  },
  enabled: open && !isEditing,
});
```

### 2. Adicionar Campo Meeting Type (R1/R2)

**Arquivo:** `src/components/crm/CloserFormDialog.tsx`

Adicionar ao estado e formulário:
```typescript
interface CloserFormDataExtended extends CloserFormData {
  // ... existentes
  meeting_type?: 'r1' | 'r2';
}

// Opções de Meeting Type
const MEETING_TYPE_OPTIONS = [
  { value: 'r1', label: 'R1 - Reunião Inicial' },
  { value: 'r2', label: 'R2 - Reunião de Fechamento' },
];
```

No JSX (após Business Unit):
```tsx
{/* Meeting Type - Mostrar apenas para Incorporador */}
{formData.bu === 'incorporador' && (
  <div className="space-y-2">
    <Label htmlFor="meeting_type">Tipo de Reunião *</Label>
    <Select
      value={formData.meeting_type || 'r1'}
      onValueChange={(v) => setFormData({ ...formData, meeting_type: v as 'r1' | 'r2' })}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecione o tipo" />
      </SelectTrigger>
      <SelectContent>
        {MEETING_TYPE_OPTIONS.map((type) => (
          <SelectItem key={type.value} value={type.value}>
            {type.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground">
      R1 para reuniões iniciais, R2 para fechamento
    </p>
  </div>
)}
```

### 3. Atualizar useCreateCloser para Salvar meeting_type

**Arquivo:** `src/hooks/useClosers.ts`

Adicionar `meeting_type` à interface e mutação:
```typescript
export interface CloserFormData {
  // ... existentes
  meeting_type?: 'r1' | 'r2';
}

// No insert:
.insert({
  // ... outros campos
  meeting_type: data.meeting_type || null,
})
```

### 4. Atualizar Texto de Ajuda no Dropdown

Mudar de:
```
"Apenas usuários com cargo 'Closer' ou 'Closer Sombra' aparecem aqui"
```

Para:
```
"Todos os usuários do sistema podem ser configurados como Closer"
```

## Resultado Esperado

| Cenário | Comportamento |
|---------|---------------|
| Dropdown de Usuários | Mostra TODOS (Luis Felipe, Thobson, Jessica, etc.) |
| BU = Incorporador | Mostra select de Meeting Type (R1/R2) |
| BU = Consórcio/Outros | Não mostra Meeting Type (não aplicável) |
| Cadastrar Luis Felipe no Consórcio | Aparece no dropdown, cadastra normalmente |

## Resumo Técnico

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/CloserFormDialog.tsx` | Remover filtro de roles, adicionar campo meeting_type condicional |
| `src/hooks/useClosers.ts` | Adicionar `meeting_type` à interface e operações CRUD |

## Fluxo de Uso

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Admin abre "Adicionar Closer"                                      │
│  1. Dropdown mostra TODOS os usuários do sistema                    │
│  2. Seleciona: Luis Felipe                                          │
│  3. Seleciona BU: Consórcio                                         │
│  4. (Meeting Type não aparece - apenas para Incorporador)           │
│  5. Clica "Adicionar"                                               │
│  6. Luis Felipe aparece na agenda do Consórcio                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Admin abre "Adicionar Closer"                                      │
│  1. Seleciona: Thobson Motta                                        │
│  2. Seleciona BU: Incorporador                                      │
│  3. Meeting Type aparece → Seleciona "R2"                           │
│  4. Clica "Adicionar"                                               │
│  5. Thobson aparece na agenda R2 do Incorporador                    │
└─────────────────────────────────────────────────────────────────────┘
```
