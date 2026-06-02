## Objetivo

Quando um SDR/Closer tentar agendar uma R1 para um lead que **já teve outra R1 nos últimos 30 dias** (configurável), o sistema deve **bloquear** o agendamento direto e abrir um pedido de **aprovação** para admin/manager/coordenador (mesma régua do fluxo "R1 em lead pago"). Vale para a Agenda R1 (drag-and-drop / drawer) e para o QuickSchedule no CRM.

## Regra de negócio

- **Janela de cooldown**: 30 dias corridos (configurável via `process_rules`).
- **O que conta como "R1 anterior"**: qualquer `meeting_slot_attendees` do mesmo `deal_id` com `meeting_type = 'r1'` cujo `scheduled_at` esteja entre `now() - cooldown_days` e `now() + cooldown_days`, e cujo status **não seja** `cancelled` nem `rescheduled` antigo de outra data. Inclui R1 realizada, no-show, agendada futura ou passada recente.
- **Quem é bloqueado**: SDR, Closer, Closer Sombra. Admin/Manager/Coordenador continuam agendando livre (sem pedido).
- **Aprovadores**: admin, manager, coordenador (mesma `is_r1_force_approver`, sem allowlist extra por enquanto — pode ser estendida depois).
- **Aprovado → cria R1 normalmente** e conta em todas as métricas (igual ao fluxo de lead pago).
- **Reagendamentos do MESMO slot** (mover horário do mesmo attendee) **não disparam** a regra — só vale para criação de **novo** R1.

## Configuração

Nova `rule_key` em `process_rules`:
- `r1_cooldown_days` → `{ "value": 30 }` (global; pode ter override por BU).
- `null`/ausente = regra desativada.

Exposto na página `/admin/regras-processo` (matriz BU × SDR/Closer) usando o componente já existente.

## Backend

1. **Edge function `calendly-create-event`** ganha novo guard `deal_r1_cooldown_active`:
   - Resolve cooldown via `get_process_rule(bu, role, 'r1_cooldown_days')`.
   - Se >0, consulta R1s anteriores do deal na janela.
   - Se encontrar e o caller **não** for aprovador, retorna `403` com `code = 'deal_r1_cooldown_active'` e `payload` (closerId, scheduledAt, durationMinutes, leadType, notes, last_r1_at, cooldown_days).
   - Mesma chave `forceFromRequestId` já existente **pula** este guard quando o request foi aprovado e tem `rule_key = 'r1_cooldown_bypass'`.

2. **`is_r1_force_approver`**: reaproveitar a função existente (mesmo conjunto de aprovadores). Se a Jessica não deve aprovar este fluxo específico, criar `is_r1_cooldown_approver` separada (decisão simples de SQL).

## Frontend

1. **`useCreateMeeting` (useAgendaData.ts)**: já propaga `error.code` + `error.payload`. Sem mudança estrutural.

2. **`QuickScheduleModal`** e **drawer da Agenda R1** (onde o erro `deal_already_paid` é tratado hoje):
   - Tratar também `deal_r1_cooldown_active`.
   - Reaproveitar `RequestR1ApprovalDialog` parametrizado com `ruleKey='r1_cooldown_bypass'` e mensagem específica ("Este lead teve R1 em DD/MM/YYYY — explique por que precisa reagendar antes dos {N} dias").
   - Hook `useCreateR1ForceRequest` ganha parâmetro `ruleKey` (default `r1_force_paid_lead`) — sem quebrar chamadas existentes.

3. **`/admin/regras-processo`**:
   - Adicionar `r1_cooldown_days` à lista de `rule_keys` editáveis (input numérico, default 30, vazio = desativa).
   - Pendentes/Histórico já listam por `rule_key` — só adicionar label amigável.

## Migração SQL (estrutura)

- `INSERT` semente em `process_rules` com `rule_key='r1_cooldown_days'`, `bu=null`, `role='sdr'` e `role='closer'`, `rule_value='{"value":30}'`, `is_active=true`.
- Opcional: helper `public.has_recent_r1(_deal_id uuid, _days int) returns timestamptz` (retorna o `scheduled_at` da R1 mais recente na janela, ou null) — usado tanto pela edge function quanto por relatórios futuros.

## Métricas / efeitos colaterais

- Sem impacto em métricas históricas.
- Pedido **rejeitado** não cria slot — comportamento idêntico ao fluxo atual.
- Pedido **aprovado** cria slot normalmente → conta em Agendamentos, no-show cap, Team Meetings KPI Matrix, etc.

## Memória a criar (após implementação)

`mem://business-logic/r1-cooldown-approval-flow` documentando: cooldown 30d configurável, guard `deal_r1_cooldown_active`, reaproveita `rule_approval_requests` com `rule_key='r1_cooldown_bypass'`, aprovadores admin/manager/coordenador.

## Fora de escopo

- Cooldown para R2 (regra separada se necessário).
- Notificação push para o aprovador (já existe o sino de pendências na sidebar).
- Allowlist extra de aprovadores (pode ser adicionada depois sem mudar a infra).