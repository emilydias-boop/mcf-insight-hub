

## Plano: Corrigir acesso ao "Meu Fechamento" para todos os cargos relevantes

### Problema

A rota `/meu-fechamento` e o link na sidebar estao restritos apenas aos cargos `sdr` e `closer`. Emily (admin) e qualquer outro cargo (manager, coordenador, financeiro, rh, etc.) recebem "Acesso Negado".

### Causa raiz

Dois arquivos restringem o acesso:

1. **`src/App.tsx` (linha 220)**: `RoleGuard allowedRoles={['sdr', 'closer']}`
2. **`src/components/layout/AppSidebar.tsx` (linha 293)**: `requiredRoles: ["sdr", "closer"]`

### Solucao

Expandir os cargos permitidos para incluir `admin`, `manager`, `coordenador` e demais cargos que possam ter um registro de SDR/Closer vinculado. A pagina ja trata graciosamente o caso de "nao cadastrado" com uma mensagem amigavel, entao nao ha risco de erro.

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` (linha 220) | Adicionar `admin`, `manager`, `coordenador`, `financeiro`, `rh` aos `allowedRoles` |
| `src/components/layout/AppSidebar.tsx` (linha 293) | Remover `requiredRoles` ou expandir para os mesmos cargos, tornando visivel para todos os autenticados |

### Detalhe tecnico

A pagina `MeuFechamento` ja possui fallback para usuarios sem registro:
```
"Voce nao esta cadastrado no sistema de fechamento."
```

Portanto, liberar o acesso nao causa problemas -- quem nao tiver fechamento simplesmente vera a mensagem informativa.

### Recomendacao

Remover completamente o `requiredRoles` da sidebar e o `RoleGuard` da rota, deixando acessivel para qualquer usuario autenticado. Isso simplifica a logica e a pagina ja se protege sozinha.

