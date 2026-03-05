

## Plano: Busca server-side para contatos

### Problema
A busca atual (`searchTerm`) filtra client-side apenas os contatos já carregados em memória. Com 118k contatos e carregamento de 500 por vez, o usuário não consegue encontrar contatos que ainda não foram carregados.

### Solução
Quando o usuário digitar no campo de busca, fazer uma query direta ao Supabase com `ilike` no nome/email/telefone, independente da paginação.

### Alterações

**`src/hooks/useContactsEnriched.ts`**
- Adicionar parâmetro `searchTerm` opcional ao `fetchContactsPage` e ao `useContactsEnriched`
- Quando `searchTerm` estiver preenchido (3+ caracteres), adicionar filtros `.or()` na query do Supabase: `name.ilike.%term%,email.ilike.%term%,phone.ilike.%term%`
- O `queryKey` incluirá o `searchTerm` para invalidar/re-fetch automaticamente

**`src/pages/crm/Contatos.tsx`**
- Aplicar debounce de 400ms no `searchTerm` antes de passá-lo ao hook (evitar queries a cada tecla)
- Passar o `debouncedSearchTerm` para `useContactsEnriched(debouncedSearchTerm)`
- Remover o filtro client-side de texto (o Supabase já faz)
- Manter os outros filtros (pipeline, stage, SDR, etc.) client-side sobre os resultados retornados

### Resultado
- Buscar "Daltron" vai consultar o banco e trazer o contato mesmo que não esteja nos primeiros 500
- Sem busca ativa, o comportamento de paginação "Carregar mais" continua igual
- Debounce evita excesso de queries

