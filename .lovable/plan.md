

## Corrigir "Acesso Negado" na aba Contatos para SDRs

### Problema
Na rota `/crm/contatos` (linha 366 do `App.tsx`), o componente `Contatos` está envolvido por um `RoleGuard` que só permite `admin`, `manager` e `coordenador`. Isso bloqueia SDRs, closers e closers_sombra.

### Solução
Em `src/App.tsx`, linha 366, adicionar `'sdr'`, `'closer'` e `'closer_sombra'` à lista de `allowedRoles` do `RoleGuard` que envolve a rota `contatos`:

```tsx
// De:
<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}>

// Para:
<RoleGuard allowedRoles={['admin', 'manager', 'coordenador', 'sdr', 'closer', 'closer_sombra']}>
```

A proteção de somente leitura já está implementada dentro do componente `Contatos.tsx` (variável `isReadOnly`), então não há risco de SDRs realizarem ações.

### Arquivo alterado
- `src/App.tsx` — expandir `allowedRoles` na rota `/crm/contatos`

