
## Objetivo imediato
Corrigir o erro ao cadastrar equipamento:

> `new row violates row-level security policy for table "assets"`

Hoje, o INSERT em `public.assets` está sendo bloqueado pelo RLS porque as policies de “Admin/Manager full access” dependem de uma função `public.get_user_role()` (sem parâmetros) que tenta ler role de `auth.users.raw_app_meta_data->>'role'`. Porém, neste projeto **as roles corretas estão na tabela `public.user_roles`** (e já existe a função `public.has_role(user_id, role)`), então `get_user_role()` retorna “viewer” e **nega INSERT/UPDATE/DELETE**.

Além disso, existe uma **sobrecarga confusa**: há duas funções `get_user_role` no schema:
- `get_user_role()` → retorna `text` via `auth.users.raw_app_meta_data` (ruim/errado para este projeto)
- `get_user_role(_user_id uuid)` → retorna `app_role` consultando `public.user_roles` (correto)

As policies atuais chamam **a versão errada** (`get_user_role()`).

---

## Diagnóstico (confirmado no banco)
- Policies em `assets`, `asset_assignments`, `asset_assignment_items`, `asset_terms`, `asset_history` usam:
  - `public.get_user_role() IN ('admin','manager')`
- `user_roles` já contém usuários `admin`/etc.
- `public.has_role(auth.uid(), 'admin')` existe e é o padrão seguro para RLS sem recursão.
- As policies estão como `TO public` (roles:{public}), o que é permissivo/desnecessário; o ideal é escopar a `authenticated`.

---

## Estratégia de correção (fase rápida e segura)
### 1) Ajustar RLS para usar `user_roles` (e não auth metadata)
Criar uma migration SQL que:
1. **Remove** a função errada `public.get_user_role()` (sem parâmetros) ou renomeia (preferível remover para evitar uso acidental).
2. **Recria** todas as policies “Admin/Manager full access …” usando:
   - `public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')`
3. **Recria** as policies aplicando a `TO authenticated` (em vez de `public`).

> Observação: em Postgres, policy `FOR ALL` sem `WITH CHECK` normalmente reaproveita a expressão para `WITH CHECK`, mas aqui o problema não é esse — é que a role nunca bate como admin/manager.

### 2) Não mexer no front-end para resolver o INSERT
O front já manda `created_by` e o payload está OK. O erro é 100% de RLS/role-check no banco.

---

## Mudanças detalhadas (SQL – o que a migration vai fazer)

### A) Remover a função errada e evitar ambiguidade
- `DROP FUNCTION IF EXISTS public.get_user_role();`  
(essa remove a versão sem parâmetros; a versão `get_user_role(uuid)` permanece)

Se preferirmos ser ainda mais explícitos:
- manter somente `has_role(...)` e evitar `get_user_role(...)` no RLS do patrimônio.

### B) Substituir policies “Admin/Manager full access …”
Para cada tabela:
- `assets`
- `asset_assignments`
- `asset_assignment_items`
- `asset_terms`
- `asset_history`

Recriar policy:

```sql
CREATE POLICY "Admin/Manager full access on assets"
ON public.assets
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);
```

(Repete o mesmo padrão para as demais tabelas, mudando apenas o nome e a tabela.)

### C) Manter as policies de “usuário comum” (SELECT limitado)
As policies de SELECT por vínculo/employee já fazem sentido e podem ficar, mas vamos também colocá-las como `TO authenticated` para reduzir superfície:

- `Users can view their assigned assets`
- `Users can view their own assignments`
- `Users can view their own assignment items`
- `Users can view their own terms`
- `Users can accept their own terms`
- `Users can view history of their assets`

---

## Sequência de implementação
1. Criar uma nova migration (incremental) só para correção de RLS do módulo Patrimônio:
   - Drop/recreate policies acima
   - Drop function `get_user_role()` sem parâmetros
2. Validar no Supabase:
   - Logar como usuário `admin` (que exista em `public.user_roles`)
   - Tentar cadastrar um equipamento
3. Testar comportamento de usuário comum:
   - Não deve conseguir cadastrar
   - Deve conseguir ver apenas equipamentos/termos vinculados ao seu `employees.user_id`

---

## Critérios de aceite (o que deve funcionar ao final)
- Admin/Manager consegue:
  - Inserir/editar/deletar assets (sem erro de RLS)
  - Inserir histórico (`asset_history`) (já ocorre no hook após create/update)
- Usuário comum:
  - Não consegue cadastrar
  - Consegue ver apenas seus assets/terms quando houver assignment ligado ao seu employee (via `employees.user_id = auth.uid()`)

---

## Riscos / pontos de atenção
- Se o usuário que está testando “admin” **não estiver** com role `admin` na tabela `public.user_roles`, continuará falhando. Se isso acontecer, vamos:
  - confirmar `select * from public.user_roles where user_id = auth.uid();` no contexto do usuário logado
- O módulo está usando `created_by` referenciando `auth.users` (FK). Isso é aceitável, mas não usaremos `auth.users` para “descobrir role”.

---

## Próximo passo após o fix de RLS
Depois de cadastrar sem erro, seguimos para as próximas entregas do módulo:
- fluxo de liberação (assignments + checklist items)
- geração/aceite do termo (asset_terms)
- devolução e conferência de itens
- drawer de detalhes com timeline (`asset_history`)
