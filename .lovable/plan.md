
# Corrigir Acesso Negado na Página "Meu Fechamento"

## Diagnóstico

A página `/meu-fechamento` está protegida por um `ResourceGuard` com o recurso `fechamento_sdr`. No entanto, na tabela `role_permissions`:

| Role | Permissão |
|------|-----------|
| admin | full ✅ |
| manager | edit ✅ |
| coordenador | edit ✅ |
| sdr | view ✅ |
| **closer** | **none ❌** |

O usuário Julio (Closer) está sendo bloqueado porque Closers têm `permission_level = 'none'` para o recurso `fechamento_sdr`.

## Solução Recomendada

Trocar o `ResourceGuard` por um `RoleGuard` na rota `/meu-fechamento`, permitindo apenas SDRs e Closers. Isso é seguro porque:
1. A página já usa `useOwnFechamento` que filtra por `user_id` - cada usuário só vê seus próprios dados
2. O sidebar já define `requiredRoles: ["sdr", "closer"]` para esta página
3. Mantém o `ResourceGuard` nas páginas de administração (`/fechamento-sdr`, `/fechamento-sdr/configuracoes`)

## Alteração no Código

**Arquivo:** `src/App.tsx` - linha 299

```text
ANTES:
<Route path="meu-fechamento" element={<ResourceGuard resource="fechamento_sdr"><MeuFechamento /></ResourceGuard>} />

DEPOIS:
<Route path="meu-fechamento" element={<RoleGuard allowedRoles={['sdr', 'closer']}><MeuFechamento /></RoleGuard>} />
```

## Resultado Esperado

- SDRs e Closers poderão acessar `/meu-fechamento` ✅
- Cada usuário verá apenas seu próprio fechamento (controlado pelo hook)
- A página de gestão `/fechamento-sdr` continua protegida para gestores

## Seção Técnica

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/App.tsx` | 299 | Substituir `ResourceGuard` por `RoleGuard` |

O `RoleGuard` já está importado e usado em outras rotas do arquivo. A mudança é de apenas uma linha.
