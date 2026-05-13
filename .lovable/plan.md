## Objetivo
Tornar o cadastro de **Colaborador (RH)** o ponto único de criação operacional. Ao criar/editar um colaborador, o sistema deve:

1. Criar (ou vincular) automaticamente o **usuário do sistema** (auth + profile + role).
2. Se o cargo for **Closer**, **Closer Sombra** ou **SDR**, criar/atualizar automaticamente o registro correspondente em `closers` ou `sdr`, com os campos operacionais editáveis ali mesmo no perfil do colaborador.

Isso elimina a tela separada `/admin/closers` e `/crm/configurar-closers` como pré-requisito — elas continuam existindo só para visão consolidada.

## Como o sistema fica

### Fluxo "Criar Colaborador" (EmployeeFormDialog)
Campos atuais + uma seção nova **Acesso ao Sistema**:
- E-mail de login (default = `email_pessoal`)
- Toggle "Criar usuário do sistema agora" (ligado por padrão se cargo tiver `role_sistema`)
- Senha provisória (gerada) + opção "Enviar convite por e-mail"

Ao salvar:
1. Insere `employees`.
2. Se toggle ligado → chama edge function `create-system-user` que:
   - cria o usuário em `auth.users` (via service role),
   - cria/atualiza `profiles` com `email`, `full_name`, `squad`, `bu`,
   - insere row em `user_roles` baseado em `cargos_catalogo.role_sistema` (closer → `closer`, sdr → `sdr`, etc.),
   - faz **backfill em `employees.user_id` e `employees.profile_id`**.
3. Se `role_sistema IN ('closer','closer_sombra')` → cria row em `closers` com `employee_id`, `email`, `name`, `bu` derivada de `cargos_catalogo.area` (Consórcio→`consorcio`, Inside Sales→`incorporador`, Crédito→`credito`), `is_active=true`. Pergunta inline: **R1 / R2 / Ambos** (se Ambos, cria 2 rows).
4. Se `role_sistema = 'sdr'` → cria row em `sdr` análogo (com `role_type='sdr'`, squad herdado).

### Aba nova no Perfil do Colaborador: "Operacional"
Renderizada **somente quando o cargo do colaborador é Closer / Closer Sombra / SDR**. Mostra e permite editar os campos hoje espalhados em `/admin/closers` e `/crm/configurar-closers`:

**Para Closer:**
- Status ativo, cor no calendário
- BU
- Tipo de reunião (R1 / R2)
- Calendly: event_type_uri, default_link
- Google Calendar: id, enabled
- (R2) priority, max_leads_per_slot

**Para SDR:**
- Status ativo, cor
- Squad / sub-squad
- `allowed_origin_ids` (pipelines visíveis)
- Permissões (`can_book_r2`, `can_handle_no_show`, etc.)

Salvar aqui faz UPDATE direto em `closers` / `sdr`.

### Mudança de cargo
Trigger em `employees`: quando `cargo_catalogo_id` muda para um cargo com `role_sistema` diferente, sincroniza:
- `user_roles` (adiciona role nova, mantém histórico de roles operacionais — não remove `closer`/`sdr` automaticamente para preservar histórico de attribution).
- Cria registro em `closers`/`sdr` se ainda não existe.
- Marca `is_active=false` no registro antigo se virou cargo não-comercial.

### Telas legadas
- `/admin/closers` e `/crm/configurar-closers` → continuam, mas viram **somente leitura/visão de lista** com link "Editar no perfil do colaborador" que abre `/rh/colaboradores/:id` aba **Operacional**.
- A criação direta nessas telas é desabilitada (botão "Novo" leva para "Criar Colaborador").

## Caso atual (Andre Nucci)
Como hot-fix antes da nova lógica entrar:
- Inserir manualmente row em `closers` com `employee_id=12a50a65-...`, `bu='consorcio'`, `meeting_type='r1'`, `name='Andre Nucci'`, `email='andre.nucci@minhacasafinanciada.com'`, `is_active=true`.
- Backfill `employees.user_id` a partir do `profile_id`.

Confirma que crio essa row de Andre **somente como R1**, ou ele também atende R2? (vi que sua rota atual é `/crm/agenda-r2`.)

## Detalhes técnicos
- Nova edge function `create-system-user` (service role), chamada do client com JWT do admin/RH.
- Mapeamento `area → bu` centralizado em `src/lib/cargoToBu.ts`.
- Hooks novos: `useEmployeeOperationalProfile(employeeId)` que une `closers` + `sdr` por `employee_id` e expõe mutations.
- RLS: continuar exigindo `admin`/`manager`/`rh` para INSERT/UPDATE em `closers` e `sdr`.
- Trigger Postgres `sync_employee_operational_role` em `employees` para o caso de mudança de cargo.
- Memória do projeto: criar `mem://architecture/employee-as-single-source-of-truth` documentando que cadastro operacional nasce no employee.

## Fora do escopo
- Não mexe em métricas de fechamento já calculadas.
- Não remove rows existentes em `closers`/`sdr` que não tenham `employee_id` (legado fica intocado).
- Não altera login social/Google OAuth.
