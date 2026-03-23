

## Plano: Corrigir fluxo de reset de senha (link sendo consumido pelo admin)

### Problema

Na linha 207 do `UserDetailsDrawer.tsx`, depois de copiar o link para a clipboard, o código faz `window.open(result.reset_link, "_blank")` — isso abre o link de recovery no navegador do **admin**. O link de recovery do Supabase é de uso único: quando o admin abre, o token é consumido e o admin é logado como o usuário (ou o token é invalidado). Quando o usuário tenta usar o mesmo link, ele já expirou.

### Correção

| Arquivo | O que muda |
|---------|-----------|
| `src/components/user-management/UserDetailsDrawer.tsx` | Remover o `window.open(...)` da linha 207. Manter apenas o `navigator.clipboard.writeText` + toast instruindo o admin a enviar o link manualmente |

### Detalhes

Remover a linha:
```typescript
window.open(result.reset_link, "_blank", "noopener,noreferrer");
```

O fluxo correto:
1. Admin clica "Gerar link de reset de senha"
2. Edge Function gera o link via API admin
3. Link é copiado para a clipboard do admin
4. Toast instrui o admin a enviar o link ao usuário (WhatsApp, email, etc.)
5. Usuário clica no link, é redirecionado para `/reset-password`, define sua senha

### Resultado
- O link não será mais consumido pelo admin
- O usuário receberá um link funcional para definir sua senha

