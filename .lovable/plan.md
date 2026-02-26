

## Problema

O botão de ação na tabela de Equipe navega para `/rh?employee=${emp.id}`, mas:
1. A rota correta é `/rh/colaboradores` (não existe rota `/rh`)
2. A página `Colaboradores.tsx` não lê o parâmetro `?employee=` da URL para abrir automaticamente o drawer do colaborador

## Solução

### 1. Corrigir a navegação no `Configuracoes.tsx`
- Mudar de `navigate('/rh?employee=${emp.id}')` para `navigate('/rh/colaboradores?employee=${emp.id}')` (botão de ação na tabela e botão "Gerenciar no RH")

### 2. Fazer `Colaboradores.tsx` ler o query param
- Importar `useSearchParams`
- No mount, verificar se existe `?employee=ID` na URL
- Se existir, buscar o employee correspondente na lista e abrir o drawer automaticamente com `setSelectedEmployee` + `setDrawerOpen(true)`

Resultado: clicar no ícone de ação leva direto à página de Colaboradores com o drawer do funcionário já aberto.

