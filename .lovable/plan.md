
# Correção: Home como Página Padrão Após Login

## Problema Identificado

Após o login, usuários estão sendo redirecionados para o **Dashboard** ao invés da **Home** (página das 4 luas).

**Causa raiz:**
1. Na página `Auth.tsx`, quando detecta usuário logado, redireciona para `/` (que é o Dashboard)
2. A rota raiz `/` no `App.tsx` aponta para o Dashboard, não para a Home

## Solução

Fazer a rota raiz `/` redirecionar automaticamente para `/home`, tornando a Home a página de entrada após login.

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Mudar rota index para redirecionar para `/home` |
| `src/pages/Auth.tsx` | Manter redirecionamento para `/` (que agora vai para Home) |

## Mudança Técnica

### App.tsx - Rota Raiz

**Antes:**
```text
<Route index element={<ResourceGuard resource="dashboard"><Dashboard /></ResourceGuard>} />
```

**Depois:**
```text
<Route index element={<Navigate to="/home" replace />} />
```

Isso significa:
- Acessar `/` → redireciona automaticamente para `/home`
- O Dashboard continua acessível em `/dashboard` (se existir) ou através do menu

## Fluxo Após a Correção

```text
Usuário faz login → AuthContext.signIn() → navega para /home
                 → Auth.tsx detecta user → navega para / → redireciona para /home
                                                          (resultado: Home)
```

## Resultado Esperado

| Ação | Destino |
|------|---------|
| Login bem-sucedido | `/home` (4 luas) |
| Acesso à URL `/` | Redireciona para `/home` |
| Clique no logo MCF | `/home` |
| Dashboard | Acessível via sidebar |
