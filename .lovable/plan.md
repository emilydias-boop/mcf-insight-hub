

## Problemas Identificados

### 1. Erro ao atualizar Role
A coluna `role` em `user_roles` usa o enum `app_role` do Postgres. O enum atual contém:
`admin, manager, viewer, sdr, closer, coordenador, rh, financeiro, closer_sombra, gr`

Mas a tabela `roles_config` tem a role **"marketing"** que **não existe no enum**. Quando o dropdown mostra "Marketing" e o usuário tenta selecionar, o INSERT falha porque o valor não é válido no enum.

### 2. BUs novas não aparecem
A lista de BUs no drawer (linhas 379-385) está **hardcoded** com apenas 5 opções (Incorporador, Consórcio, Crédito, Projetos, Leilão). Falta "Marketing" e qualquer outra BU nova.

---

## Solução

### Migração SQL
Adicionar `marketing` ao enum `app_role`:
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketing';
```

### `UserDetailsDrawer.tsx`
Trocar a lista hardcoded de BUs por dados dinâmicos. Duas opções:
- Buscar de uma tabela/config de BUs
- Ou ao menos adicionar "marketing" à lista estática

A abordagem mais prática: adicionar `{ value: 'marketing', label: 'BU - Marketing' }` à lista existente, pois as BUs são uma lista fixa do negócio.

### Arquivos a modificar
- **Migration SQL** — `ALTER TYPE app_role ADD VALUE 'marketing'`
- **`UserDetailsDrawer.tsx`** — adicionar "Marketing" na lista de BUs (linha 384)

