
# Plano: Corrigir Race Condition no R2AccessGuard para Thobson

## Problema Identificado

Thobson (thobson.motta@minhacasafinanciada.com) tem role `coordenador` que **deveria** permitir acesso à Agenda R2, mas está sendo negado devido a uma race condition:

### Dados do Usuário:
| Campo | Valor |
|-------|-------|
| ID | `a15cb111-8831-4146-892a-d61ca674628a` |
| Email | thobson.motta@minhacasafinanciada.com |
| Role | coordenador |
| R2_ALLOWED_ROLES | ['admin', 'manager', **'coordenador'**] |

### Sequência do Bug:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  1. Thobson faz login ou navega para /crm/agenda-r2                 │
│  2. handleSession() executa:                                        │
│     - setSession(session)                                           │
│     - setUser(user)                                                 │
│     - setLoading(false) ← authLoading = false                       │
│     - setRole('viewer')  ← DEFAULT temporário                       │
│     - setRoleLoading(false) ← AINDA false (estado inicial!)         │
│     - setTimeout(() => loadRolesInBackground(...), 0)               │
│                                                                     │
│  3. RACE CONDITION: React renderiza ANTES do setTimeout executar    │
│     - authLoading = false                                           │
│     - roleLoading = false (nunca foi true!)                         │
│     - role = 'viewer' (não 'coordenador')                           │
│                                                                     │
│  4. R2AccessGuard avalia:                                           │
│     - hasRoleAccess = R2_ALLOWED_ROLES.includes('viewer') = FALSE   │
│     - Resultado: "Acesso Negado" ❌                                 │
│                                                                     │
│  5. setTimeout finalmente executa loadRolesInBackground:            │
│     - setRoleLoading(true) ← muito tarde                            │
│     - Busca role real: 'coordenador'                                │
│     - setRoleLoading(false)                                         │
│     - Mas dano já foi feito (tela de erro já apareceu)              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Solução

Garantir que `roleLoading = true` ANTES de agendar a busca em background, eliminando a janela de race condition.

### Alteração no AuthContext

**Arquivo:** `src/contexts/AuthContext.tsx`

**Linha ~219-222** - Modificar handleSession para definir roleLoading=true ANTES do setTimeout:

```typescript
// ANTES (linha 219-222):
// Background: update last_login_at (non-blocking)
setTimeout(() => {
  loadRolesInBackground(newSession.user.id, myVersion);
}, 0);

// DEPOIS:
// Set roleLoading=true BEFORE scheduling background load to prevent race condition
setRoleLoading(true);

// Load roles in background (non-blocking)
setTimeout(() => {
  loadRolesInBackground(newSession.user.id, myVersion);
}, 0);
```

### Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│  1. Thobson navega para /crm/agenda-r2                              │
│  2. handleSession() executa:                                        │
│     - setLoading(false)                                             │
│     - setRole('viewer')                                             │
│     - setRoleLoading(true) ← NOVO! Antes do setTimeout              │
│     - setTimeout(() => loadRolesInBackground(...), 0)               │
│                                                                     │
│  3. React renderiza:                                                │
│     - authLoading = false                                           │
│     - roleLoading = TRUE ← Guard espera                             │
│                                                                     │
│  4. R2AccessGuard avalia:                                           │
│     - if (authLoading || roleLoading) return null; ← ESPERA         │
│                                                                     │
│  5. loadRolesInBackground executa:                                  │
│     - Busca role real: 'coordenador'                                │
│     - setRole('coordenador')                                        │
│     - setRoleLoading(false)                                         │
│                                                                     │
│  6. R2AccessGuard reavalia:                                         │
│     - hasRoleAccess = R2_ALLOWED_ROLES.includes('coordenador') ✓    │
│     - Resultado: Acesso permitido ✓                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Resumo Técnico

| Arquivo | Alteração |
|---------|-----------|
| `src/contexts/AuthContext.tsx` | Adicionar `setRoleLoading(true)` antes do `setTimeout` na função `handleSession` |

---

## Impacto

| Cenário | Antes | Depois |
|---------|-------|--------|
| Thobson (coordenador) acessa R2 | Acesso negado (race condition) | Acesso permitido |
| Outros coordenadores | Mesmo bug potencial | Corrigido |
| Admin/Manager | Funcionava (roles carregam rápido) | Mantém |
| Tempo de loading | Instantâneo (mas errado) | +0.5s (correto) |

A correção adiciona um breve delay visual (mostra loading enquanto busca roles) mas garante que a avaliação de permissão aconteça com os dados corretos.
