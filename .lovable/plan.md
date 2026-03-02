

## Problema

Os dropdowns de "Role de sistema" em **3 locais** estão com roles **hardcoded** em vez de buscar da tabela `roles_config`:

1. **`UserDetailsDrawer.tsx`** (linha 347-354) — SelectItems fixos (Admin, Manager, Coordenador, SDR, Closer, Viewer)
2. **`CargoFormDialog.tsx`** (linha 37-44) — constante `ROLE_SISTEMA_OPTIONS` hardcoded
3. **`user-management.ts`** (linha 160+) — `ROLE_LABELS` hardcoded

## Solução

Substituir todas as listas hardcoded pelo hook `useRolesConfig(true)` que já busca roles ativos da tabela `roles_config`.

### Mudanças

**`UserDetailsDrawer.tsx`**
- Importar `useRolesConfig`
- Substituir os 6 `<SelectItem>` fixos por um `.map()` sobre `roles` do hook

**`CargoFormDialog.tsx`**
- Importar `useRolesConfig`
- Remover constante `ROLE_SISTEMA_OPTIONS`
- Usar `roles` do hook no `.map()` do Select

**`user-management.ts`**
- O `ROLE_LABELS` estático pode continuar como fallback, mas os componentes acima passarão a usar dados dinâmicos da tabela

**`CreateUserDialog.tsx`** (verificar se também usa lista hardcoded)
- Se sim, aplicar a mesma correção

