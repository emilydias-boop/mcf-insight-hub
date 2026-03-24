

## Correção: Antony aparecendo como SDR na distribuição de leads

### Problema

O hook `useSdrsFromSquad` busca registros da tabela `sdr` onde `role_type = 'sdr'` e `active = true`. Antony tem um registro nessa tabela como SDR do consórcio, mas na realidade ele é **admin**. O cross-check atual só exclui usuários bloqueados/desativados — não verifica se o usuário tem um cargo administrativo na tabela `user_roles`.

### Solução

Adicionar um segundo cross-check no `useSdrsFromSquad` que exclui usuários com roles administrativas (`admin`, `manager`, `coordenador`) da listagem de SDRs para distribuição.

### Detalhes técnicos

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useSdrsFromSquad.ts` | Após o cross-check de `access_status`, adicionar query em `user_roles` para os mesmos emails, filtrar quem tem role `admin`, `manager` ou `coordenador`, e excluí-los do resultado final |

A lógica adicional:
1. Buscar `user_roles` com `role IN ('admin', 'manager', 'coordenador')` para os profile IDs dos SDRs retornados
2. Excluir esses usuários do array final

Isso garante que admins como Antony não apareçam na lista de distribuição, mesmo que tenham registro ativo na tabela `sdr`.

