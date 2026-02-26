

## Diagnóstico

O erro `consorcioWeekly is not defined` não existe no código atual. O arquivo `useSetoresDashboard.ts` usa corretamente `consorcioCardsWeekly` (linhas 102, 170, 213). 

Isso é um **cache de build desatualizado** — o preview está rodando uma versão anterior do código que ainda referenciava uma variável chamada `consorcioWeekly` (provavelmente de uma edição intermediária que não foi salva corretamente).

## Correção

Nenhuma mudança de código é necessária. O arquivo já está correto. Basta forçar um rebuild:

1. **Forçar rebuild** — fazer qualquer micro-edição no arquivo (ex: adicionar/remover um espaço em branco em um comentário) para invalidar o cache do Vite e forçar recompilação.

Se o erro persistir após rebuild, posso investigar se há outro arquivo importando uma versão antiga do hook.

