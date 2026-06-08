
## Objetivo

Permitir que você mude o cargo/nível de qualquer colaborador **com data retroativa**, sem precisar pedir migration toda vez. Isso atualiza o histórico (`employee_cargo_history`), o cargo atual em `employees` e os planos de comissão (`sdr_comp_plan`) afetados pelo período — disparando o recálculo automático do payout.

Como primeiro uso, já aplico: **Julio Caetano → Closer Inside N2 a partir de 01/05/2026** e **Mayara Souza → SDR Inside N3 a partir de 01/05/2026**.

---

## Parte 1 — Tela self-service "Alterar cargo (retroativo)"

**Onde:** botão novo na aba **Geral** do perfil do colaborador (`/rh/colaboradores/:id`), ao lado do "Editar". Label: **"Alterar cargo"**.

**Dialog "Alterar cargo":**
- Cargo novo (CargoSelect — só cargos ativos)
- **A partir de** (date picker, default = hoje; aceita data passada)
- Motivo (texto curto, opcional)
- Checkbox **"Atualizar planos de comissão a partir desta data"** (marcado por padrão)
- Aviso quando a data é retroativa: lista os meses afetados (ex. "maio/2026, junho/2026") e quais payouts serão recalculados.

**O que a tela faz ao salvar** (edge function `change-employee-cargo`):
1. Fecha o segmento aberto em `employee_cargo_history` com `valid_to = data_escolhida - 1 dia`.
2. Insere novo segmento `(employee_id, cargo_novo, valid_from = data_escolhida, valid_to = NULL, motivo, created_by)`.
3. Se a data ≤ hoje, atualiza `employees.cargo_catalogo_id` para o cargo novo (cargo "vigente hoje").
4. Se o checkbox estiver marcado:
   - Encerra `sdr_comp_plan` ativos com `vigencia_fim = data_escolhida - 1 dia` (apenas os do `sdr` vinculado a esse colaborador).
   - Cria um novo `sdr_comp_plan` por mês afetado (data_escolhida → mês corrente, open-ended no último), copiando OTE/fixo/variável/metas do **cargo novo** em `cargos_catalogo`, com `status = PENDING` (mantém suas regras atuais de aprovação).
5. Atualiza `sdr.nivel` (para refletir nível atual do role).
6. Dispara `recalculate-sdr-payout` para cada mês afetado (Julio + Mayara já têm o `employee_cargo_history` + segmentos lidos pelo recalc — então o pró-rata por cargo já funciona; só precisamos chamá-lo).

**Permissão:** só Admin/Gerente de RH. Usa as roles existentes (`has_role`).

**Trigger:** desativo temporariamente (na própria função, via transação) o trigger atual que cria `employee_cargo_history` automaticamente na mudança de `employees.cargo_catalogo_id`, para não duplicar o segmento — já que a função gerencia o histórico manualmente.

---

## Parte 2 — Aplicar as 2 trocas retroativas (maio/2026)

Executo via a mesma edge function, simulando o uso da tela:

**Julio Caetano** (`74d4da35-...`)
- Histórico: fecha `Closer Inside N1` em 2026-04-30; insere `Closer Inside N2` (`fd8d5a86-...`) a partir de 2026-05-01, sem fim.
- `employees.cargo_catalogo_id` → N2.
- `sdr_comp_plan` (sdr_id `21393c7b-...`): o plano aberto desde 01/04/2026 com N1 será fechado em 2026-04-30; cria plano de maio em diante com N2 (OTE 8000 / Fixo 5600 / Variável 2400), `status = PENDING`. O parâmetro de **35% sobre R2 Realizada → contrato** continua sendo o do plano de closer (não está em `sdr_comp_plan` — o cálculo do Closer Inside lê os pesos pré-definidos no recalculate). Confirmação: hoje o Julio não tem plano de maio com nível diferente, então só a troca de cargo já faz o payout de maio rodar como N2.
- Recalcula payouts de maio e junho/2026.

**Mayara Souza** (`40f66bf5-...`)
- Histórico: fecha `SDR Inside N1` em 2026-04-30; insere `SDR Inside N3` (`816b5f53-...`) a partir de 2026-05-01.
- `employees.cargo_catalogo_id` → N3, `sdr.nivel = 3`.
- `sdr_comp_plan` (sdr_id `9028b01c-...`): plano de maio atual (`c19cfcc7-...`) é **atualizado** para `cargo_catalogo_id = N3`, OTE 5000 / Fixo 3500 / Variável 1500 (mantém metas já configuradas: 228 agendadas / 160 realizadas), `status = PENDING` para reaprovação.
- Recalcula payout de maio e junho/2026.

---

## Sobre o "35% sobre R2 Realizada → contratos" do Julio

Verifiquei: esse parâmetro **não fica em `sdr_comp_plan`** (essa tabela tem `valor_meta_rpg`, `valor_docs_reuniao`, etc., para SDR — não tem o split de R2 do closer). Para closer, o `recalculate-sdr-payout` usa os pesos padrão por cargo. Trocando o cargo do Julio para `Closer Inside N2`, o recálculo já aplica a régua de N2 automaticamente.

**Se** o "35% sobre R2 realizada" for um valor que precisa entrar **explicitamente em algum lugar** (ex. uma config nova por nível), me confirme onde ele é editado hoje — neste caso eu acrescento o campo. Caso contrário, basta o cargo virar N2.

---

## Detalhes técnicos

- Nova edge function: `change-employee-cargo` (POST `{ employee_id, cargo_catalogo_id, valid_from, motivo, update_comp_plans }`)
- Novo componente: `src/components/hr/ChangeCargoDialog.tsx`
- Hook: `useChangeEmployeeCargo` (mutation + invalidate de queries de RH e fechamento)
- Migration: trigger de `employee_cargo_history` ganha um `WHEN (pg_trigger_depth() = 0 AND current_setting('app.skip_cargo_history_trigger', true) IS DISTINCT FROM 'on')` para a edge function poder suprimir.
- Edge function chama `recalculate-sdr-payout` por mês afetado.
- Logs de auditoria em `audit_logs` (`action = 'cargo_change_retroativo'`).

---

## O que NÃO vou mexer

- Não altero a tela de **Editar colaborador** existente (continua editando "cargo vigente hoje" como sempre).
- Não mexo na régua de comissão de Consórcio nem nos planos de outros colaboradores.
- Não toco em payouts já `LOCKED` — se algum mês afetado estiver travado, a função aborta e mostra erro claro.
