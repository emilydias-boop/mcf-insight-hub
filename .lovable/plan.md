
# Plano: Suporte a Múltiplas BUs por Usuário

## Problema Atual

O campo `squad` na tabela `profiles` é do tipo TEXT, permitindo apenas **uma BU por usuário**. Thobson está configurado como "consorcio", então:

- Ele não vê os menus de "BU - Incorporador MCF" na sidebar
- Ele não consegue acessar `/crm/agenda-r2` (CRM do Incorporador)

## Solução Proposta

Alterar o sistema para suportar múltiplas BUs por usuário através de um campo array.

---

## Alterações no Banco de Dados

### 1. Migração do campo `squad`

Executar SQL no Supabase para converter o campo de TEXT para TEXT[]:

```sql
-- Backup do valor atual
ALTER TABLE profiles ADD COLUMN squad_backup TEXT;
UPDATE profiles SET squad_backup = squad;

-- Converter para array
ALTER TABLE profiles 
  ALTER COLUMN squad TYPE TEXT[] 
  USING CASE 
    WHEN squad IS NOT NULL THEN ARRAY[squad]
    ELSE NULL
  END;
```

---

## Alterações no Código

### 2. Hook useMyBU

**Arquivo:** `src/hooks/useMyBU.ts`

Atualizar para retornar array de BUs:

```typescript
export function useMyBU() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-bu", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("profiles")
        .select("squad")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      // Retorna array de BUs ou array vazio
      return (data?.squad as BusinessUnit[]) || [];
    },
    enabled: !!user?.id,
  });
}

// Helper para verificar se usuário tem acesso a uma BU específica
export function useHasBUAccess(bu: BusinessUnit): boolean {
  const { data: myBUs = [] } = useMyBU();
  return myBUs.includes(bu);
}
```

### 3. Hook useActiveBU

**Arquivo:** `src/hooks/useActiveBU.ts`

Ajustar para funcionar com array:

```typescript
export function useActiveBU(): BusinessUnit | null {
  const buContext = useContext(BUContext);
  const { data: userBUs = [] } = useMyBU();

  return useMemo(() => {
    // Se temos BU no contexto (da rota), usa ela
    if (buContext.activeBU) {
      return buContext.activeBU;
    }
    
    // Retorna a primeira BU do usuário (ou null)
    return userBUs[0] || null;
  }, [buContext.activeBU, userBUs]);
}
```

### 4. AppSidebar - Filtro de BU

**Arquivo:** `src/components/layout/AppSidebar.tsx`

Atualizar lógica de filtragem para verificar se **qualquer** BU do usuário está na lista:

```typescript
// Linha ~377-382
// Verificação de BU para SDRs - ATUALIZADO PARA ARRAY
if (item.requiredBU && item.requiredBU.length > 0) {
  // Se o usuário não tem BUs ou nenhuma BU do usuário está na lista permitida
  if (!myBUs || myBUs.length === 0) {
    return false;
  }
  // Verifica se alguma BU do usuário está na lista requerida
  const hasMatchingBU = myBUs.some(bu => item.requiredBU!.includes(bu));
  if (!hasMatchingBU) {
    return false;
  }
}
```

### 5. Página de Gerenciamento de Usuários

**Arquivo:** `src/pages/GerenciamentoUsuarios.tsx` (ou componente de edição)

Atualizar UI para permitir seleção múltipla de BUs com checkboxes:

```typescript
// Trocar Select por CheckboxGroup
<div className="space-y-2">
  <Label>Business Units</Label>
  {BU_OPTIONS.filter(bu => bu.value).map((bu) => (
    <div key={bu.value} className="flex items-center space-x-2">
      <Checkbox
        checked={selectedBUs.includes(bu.value as BusinessUnit)}
        onCheckedChange={(checked) => {
          if (checked) {
            setSelectedBUs([...selectedBUs, bu.value as BusinessUnit]);
          } else {
            setSelectedBUs(selectedBUs.filter(b => b !== bu.value));
          }
        }}
      />
      <Label>{bu.label}</Label>
    </div>
  ))}
</div>
```

---

## Resumo das Alterações

| Componente | Alteração |
|------------|-----------|
| **Banco de dados** | Migrar `squad` de TEXT para TEXT[] |
| `useMyBU` | Retornar `BusinessUnit[]` em vez de `BusinessUnit \| null` |
| `useActiveBU` | Trabalhar com array de BUs |
| `AppSidebar` | Verificar `myBUs.some()` em vez de `myBU === ` |
| UI de Usuários | Checkboxes para múltiplas BUs |

---

## Resultado Esperado

Após as alterações, Thobson poderá:

| Cenário | Antes | Depois |
|---------|-------|--------|
| Ver menu "BU - Incorporador MCF" | Não vê | Vê |
| Ver menu "BU - Consórcio" | Vê | Vê |
| Acessar `/crm/agenda-r2` | Bloqueado (não está na BU) | Permitido |
| Acessar `/consorcio/crm` | Permitido | Permitido |

---

## Configuração do Thobson Após Implementação

```sql
UPDATE profiles 
SET squad = ARRAY['incorporador', 'consorcio']
WHERE id = 'a15cb111-8831-4146-892a-d61ca674628a';
```
