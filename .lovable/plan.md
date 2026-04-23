

## Permitir reagendamento de R1 Realizada com contagem honesta

### Regra acordada (resumo)

A trava atual bloqueia **qualquer** reagendamento de R1 que já foi Realizada no mês. Isso é restritivo demais — leads legítimos (ex: precisa reunir com o sócio) ficam travados. A nova regra é:

| Situação do deal | Pode agendar? | Conta para o SDR? |
|---|---|---|
| Sem agendamento prévio | Sim (1º Agendamento) | Sim — conta como **agendamento** |
| Já tem 1º Agendamento (futuro) | Não — usa "Reagendar" da Agenda | — |
| R1 Realizada (foi o 1º Agendamento) e novo agendamento | **Sim** | Sim — conta como **1º Reagendamento (válido)** |
| R1 Realizada precedida de No-Show e novo agendamento | **Sim** | Sim — conta como **1º Reagendamento (válido)** |
| Já teve 1 Agendamento + 1 Reagendamento Válido (qualquer combinação) | **Sim, agenda mas não conta** | Não — vira **Reagendamento Inválido** (registrado mas fora da meta) |
| Contrato Pago / Won | Não | — |

**Limite duro**: cada deal contabiliza no máximo **2 movimentos** para o SDR (1 agendamento + 1 reagendamento válido). Tudo acima disso pode ser agendado para resolver o caso operacional, mas é registrado como "Reagendamento Inválido" e não infla métrica.

**Escopo**: vale só para **R1**. R2 fica como está (sem trava de contagem).

### Mudanças necessárias

**1. Frontend — destravar R1 Realizada (`useAgendaData.ts`)**

Linhas 1046-1085 hoje bloqueiam novo R1 se completou no mês corrente. Mudar para:

- Sempre liberar agendamento de R1 quando o estado for `completed` (R1 Realizada).
- Substituir o `blockReason` por um **aviso** (`warningOnly = true`):
  - "Lead já realizou R1. Este será o **1º Reagendamento** (conta para sua meta)." se ainda não houve reagendamento válido.
  - "Lead já tem agendamento + reagendamento válido. Pode agendar, mas **não contará** na sua meta." quando já bateu o teto.
- Manter bloqueio total apenas para: `contract_paid`, `won`, `scheduled_future` (R1 futura ativa do mesmo tipo).

Isso requer consultar quantos reagendamentos válidos o deal já tem — adicionar query auxiliar no enriquecimento do search (já existe estrutura de `atts`).

**2. Frontend — `BlockedLeadCard.tsx` e `QuickScheduleModal.tsx`**

- Remover/abrandar o estado `completed` do `BlockedLeadCard`. Em vez disso, mostrar banner informativo amarelo no modal explicando se vai contar ou não.
- Badge no resultado de busca: "✅ R1 realizada — reagendamento contará" vs "✅ R1 realizada — reagendamento NÃO contará (limite atingido)".

**3. Backend — `calendly-create-event/index.ts`**

Linha 535-541 retorna 409 com `r1_already_completed_this_month`. Remover essa trava — passa a permitir a criação. A classificação de "conta ou não" é responsabilidade do RPC de métricas, não do gateway de booking.

**4. Backend — RPC `get_sdr_metrics_from_agenda` (versão 4-arg atual)**

CTE `agendamentos_cte` (linhas 179-191) hoje considera apenas `parent_attendee_id IS NULL` ou primeiro nível de filho. Precisa virar uma **classificação por ordem de movimento dentro do deal**:

```sql
-- Pseudocódigo da nova lógica
WITH ranked_movements AS (
  SELECT
    sdr_email, deal_id, effective_booked_at,
    ROW_NUMBER() OVER (PARTITION BY deal_id ORDER BY effective_booked_at) as ordem
  FROM raw_attendees
)
SELECT sdr_email, COUNT(*) as agendamentos
FROM ranked_movements
WHERE ordem <= 2  -- só os 2 primeiros movimentos contam (1 agend + 1 reagend)
  AND (effective_booked_at AT TIME ZONE 'America/Sao_Paulo')::date
      BETWEEN start_date AND end_date
GROUP BY sdr_email;
```

Isto substitui a lógica atual baseada em `parent_attendee_id`/`is_reschedule` por uma **regra ordinal**: o 1º e o 2º movimento contam, o 3º+ não — independente do motivo. Garante que a soma jamais ultrapasse 2 por deal.

**5. Backend — RPC de listagem `get_sdr_meetings_from_agenda` (tipo de movimento)**

A coluna `tipo` exibida na tabela hoje vem da CTE `all_movements` (migration 20251218180500) com regras antigas baseadas em No-Show. Atualizar para refletir a regra ordinal:

- `ordem = 1` → `'1º Agendamento'`
- `ordem = 2` → `'Reagendamento Válido'`
- `ordem >= 3` → `'Reagendamento Inválido'`

Garante que UI (badges em `MeetingsTable.tsx` e `SdrLeadsTable.tsx`) reflita exatamente o que entrou na métrica.

**6. UI — feedback claro no momento do agendamento**

No `QuickScheduleModal`, ao confirmar reagendamento de R1 já Realizada:
- Toast de sucesso: "Reagendamento criado. Conta como 1º Reagendamento na sua meta." OU "Reagendamento criado. Não conta na meta (já há 1 reagendamento válido neste deal)."

### Validação anti-burla

- O `r1_agendada` continua com `LEAST(COUNT(DISTINCT meeting_day), 2)` — defesa em profundidade.
- A nova `agendamentos_cte` com `ordem <= 2` é o teto por movimento.
- SDR não consegue inflar criando 5 reagendamentos: do 3º em diante, a UI mostra "não conta", a métrica ignora, e o histórico fica auditável.

### Arquivos afetados

- `src/hooks/useAgendaData.ts` (linhas 1046-1085) — relaxar trava `completed`
- `src/components/crm/BlockedLeadCard.tsx` — remover/ajustar estado `completed`
- `src/components/crm/QuickScheduleModal.tsx` — banner amarelo + badge contextual no resultado de busca
- `supabase/functions/calendly-create-event/index.ts` (linhas ~530-545) — remover bloqueio 409
- Nova migration: substituir `get_sdr_metrics_from_agenda` (4-arg) com lógica ordinal de `ordem <= 2`
- Nova migration: substituir RPC de `get_sdr_meetings_from_agenda` para emitir `tipo` baseado em `ordem`
- `src/types/r2Agenda.ts` / `src/hooks/useSdrMeetingsFromAgenda.ts` — sem mudança estrutural; apenas continua mapeando os 3 tipos já existentes

### Reversibilidade

- Migrations criam funções `CREATE OR REPLACE`, fáceis de reverter para versão atual se necessário.
- Mudanças de UI são puramente visuais — sem perda de dado.
- Edge function: a trava removida pode ser reposta com 3 linhas se houver regressão.

### Comportamento esperado pós-deploy

1. SDR busca lead com R1 Realizada → modal abre normalmente, mostra banner "Será 1º Reagendamento — conta na meta".
2. SDR confirma → reunião criada, badge "Reagendamento" aparece na lista, métrica do mês incrementa em +1.
3. Mesmo deal volta para reagendar de novo → modal abre, banner amarelo: "Já há 1 reagendamento válido. Este novo NÃO contará na meta".
4. SDR confirma → reunião criada, badge "Reagendamento" cinza (Inválido), métrica não incrementa.
5. Contrato Pago / Won continua bloqueado totalmente.

