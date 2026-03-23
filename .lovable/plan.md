

## Plano: Corrigir role não atualizada para assistente_administrativo

### Diagnóstico

O banco de dados **já está correto** — o Antony Nicolas tem `assistente_administrativo` na tabela `user_roles`. O problema tem duas causas:

1. **AuthContext.tsx desatualizado**: O tipo `AppRole` (linha 8) e o mapa `ROLE_PRIORITY` (linhas 10-20) não incluem `assistente_administrativo`, `marketing`, `gr` e outros cargos novos. Quando o JWT retorna essas roles, elas recebem prioridade `99` e podem ser ignoradas ou mal interpretadas.

2. **JWT do usuário ainda contém a role antiga**: O token JWT só é atualizado no próximo login ou refresh automático (~1h). Como o admin mudou a role, o usuário precisa re-logar para o JWT refletir a nova role. O sistema não força refresh do token de outro usuário.

### Correção

| Arquivo | O que muda |
|---------|-----------|
| `src/contexts/AuthContext.tsx` | Adicionar `assistente_administrativo`, `marketing`, `gr` ao tipo `AppRole` e ao `ROLE_PRIORITY` |
| `src/hooks/useUserMutations.ts` | No `useUpdateUserRole`, após sucesso, mostrar toast informando que o usuário precisa re-logar para a mudança ter efeito |

### Detalhes

1. **Atualizar `AppRole` type**:
```typescript
type AppRole = 'admin' | 'manager' | 'viewer' | 'sdr' | 'closer' | 'coordenador' 
  | 'closer_sombra' | 'financeiro' | 'rh' | 'gr' | 'marketing' | 'assistente_administrativo';
```

2. **Atualizar `ROLE_PRIORITY`**:
```typescript
const ROLE_PRIORITY: Record<string, number> = {
  admin: 1,
  manager: 2,
  coordenador: 3,
  closer: 4,
  closer_sombra: 5,
  financeiro: 6,
  rh: 7,
  gr: 8,
  assistente_administrativo: 9,
  marketing: 10,
  sdr: 11,
  viewer: 12,
};
```

3. **Melhorar feedback ao trocar role**:
   - Toast de sucesso: "Role atualizado com sucesso. O usuário precisa fazer logout e login novamente para a mudança ter efeito."

### Resultado
- Roles novas (`assistente_administrativo`, `marketing`, `gr`) são reconhecidas pelo AuthContext
- O admin recebe feedback claro de que o usuário precisa re-logar
- O sistema funciona corretamente após o re-login do usuário

