# Karen Nazário com perfil de gerente de relacionamento

## Estado atual (verificado no banco)

- Karen Nazario da Conceição (karen.nazario@minhacasafinanciada.com):
  - `user_roles`: apenas **sdr**
  - `profiles.squad`: **[credito]**, access_status ativo
  - Permissões: `can_handle_no_show = true`, demais flags false — **já idênticas às dos gerentes**
  - `employees`: squad **credito**, cargo vazio, status ativo
- Gerentes de relacionamento (Kalyanne, Vitor, Rebeca):
  - `user_roles`: **gerente_relacionamento** (Rebeca também tem viewer)
  - `profiles.squad`: **[pos_venda]**

## Mudanças (uma migration, com aprovação)

1. **Papel**: inserir `gerente_relacionamento` em `user_roles` para a Karen, **mantendo** o papel `sdr` (decisão do usuário). O sistema usa o papel de maior prioridade no JWT.
2. **Squad no perfil**: `profiles.squad` de `[credito]` para `[pos_venda]` (decisão do usuário).
3. **Squad no cadastro de RH**: `employees.squad` de `credito` para `pos_venda`, mantendo a sincronização bidirecional employees ↔ profiles consistente.
4. Nenhuma flag de permissão precisa mudar — já estão iguais às dos gerentes.

## Verificação depois de aplicar

- Consulta read-only confirmando: Karen com papéis `sdr` + `gerente_relacionamento`, squad `pos_venda` em profiles e employees.

## Fora de escopo

- Nenhum código alterado, nada publicado.
- Não mexo em cargo, metas ou comissões da Karen.
