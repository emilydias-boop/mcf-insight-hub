

## Problema: Usuarios sendo deslogados apos ~5 segundos

### Causa raiz

Ha uma **race condition** no `AuthContext.tsx` entre o `onAuthStateChange` e o `getSessionWithTimeout`:

1. `SIGNED_IN` dispara primeiro → `initialSessionHandled.current` ainda e `false` → **nao** seta `initialSessionHandled` → chama `handleSession(session)` → usuario autenticado corretamente
2. `getSessionWithTimeout` tem timeout de **5 segundos** (`AUTH_TIMEOUT_MS = 5000`). Se o servidor demora (os logs mostram 429 rate limit nos token refreshes), o timeout retorna `{ data: { session: null } }`
3. `initialSessionHandled.current` ainda e `false` (so e setado pelo `INITIAL_SESSION` event ou pelo proprio `getSessionWithTimeout`) → chama `handleSession(null)` → **limpa user/session/role** → loading=false → ProtectedRoute ve `!user` → redireciona para `/auth`

Os auth logs confirmam: multiplos requests simultaneos de `refresh_token` gerando **429 rate limit**, o que atrasa o `getSession()` alem dos 5s.

### Correcao

**`src/contexts/AuthContext.tsx`** -- 2 mudancas:

1. **Marcar `initialSessionHandled` no SIGNED_IN tambem**: O evento SIGNED_IN que ocorre na inicializacao (quando `initialSessionHandled` e false) deve setar o ref para `true`, impedindo que o timeout do getSession sobrescreva.

2. **No getSessionWithTimeout, nao limpar sessao valida**: Antes de chamar `handleSession(null)`, verificar se ja existe um user no state. Se ja existe, ignorar o resultado nulo do timeout.

Concretamente:

```typescript
// Linha ~171: Antes do check de session restoration, marcar como handled
if (event === 'SIGNED_IN' && !initialSessionHandled.current && newSession) {
  initialSessionHandled.current = true;
  handleSession(newSession);
  return;
}

// No getSessionWithTimeout (~205-208): proteger contra limpar sessao valida
if (!initialSessionHandled.current) {
  initialSessionHandled.current = true;
  // Só processar se realmente temos dados OU se não temos user ainda
  if (result.data.session || !user) {
    handleSession(result.data.session);
  }
}
```

Isso resolve o cenario: SIGNED_IN seta `initialSessionHandled = true`, e o timeout do getSession nao faz nada.

### Resultado
- Usuarios que logam com sucesso nao serao mais deslogados pelo timeout de 5s
- O 429 rate limit no token refresh nao causara mais perda de sessao
- Nenhuma alteracao visual ou de UX

