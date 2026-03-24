

## Diagnóstico: Role incorreto para Antony Nicolas

### Dados verificados

| Item | Valor |
|------|-------|
| Usuário | Antony Nicolas Gomes Rosa |
| user_id | d77b494c-7b81-4714-a941-8e8d051b72f2 |
| Role no banco (user_roles) | `assistente_administrativo` |
| Permissão global CRM | `view` |
| Permissão BU consórcio CRM | `full` |

### Causa raiz provável

O role no banco está correto (`assistente_administrativo`), mas o **JWT do usuário pode estar desatualizado**. O sistema lê roles diretamente do token JWT via `custom_access_token_hook`. Se o role foi alterado recentemente e o usuário não fez logout/login, o JWT antigo pode ainda conter `viewer` (ou nenhum role), fazendo o `ResourceGuard` negar acesso.

### Solução

**Passo 1 — Confirmar**: Pedir ao usuário Antony Nicolas para **fazer logout e login novamente**. Isso força um novo JWT com o role `assistente_administrativo` injetado pelo hook.

**Passo 2 — Se persistir**: Verificar via logs do Supabase se o `custom_access_token_hook` está retornando `assistente_administrativo` no array `user_roles` do token para esse user_id.

**Passo 3 — Fallback técnico (se necessário)**: Adicionar log temporário no `AuthContext` para exibir no console o conteúdo do JWT decodificado, confirmando quais roles estão no token. Isso pode ser feito adicionando um `console.log` no `extractRolesFromSession`:

```typescript
// Em extractRolesFromSession, após decodificar:
console.log('[Auth] JWT decoded roles for user:', newSession.user.email, tokenRoles);
```

### Resumo

O banco está correto. O problema é quase certamente um **JWT stale** (desatualizado). Logout + login resolve na maioria dos casos. Se não resolver, investigamos o hook do token.

