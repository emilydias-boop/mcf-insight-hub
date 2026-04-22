

## Liberar reagendamento de R1 quando a anterior foi realizada em mês diferente

### Regra atual

Hoje, qualquer R1 com `status = 'completed'` no histórico do lead bloqueia novo agendamento de R1, em dois pontos:

1. **Backend** (`supabase/functions/calendly-create-event/index.ts`, linhas 507–530) — guard #4 retorna `409 r1_already_completed`.
2. **Frontend** (`src/hooks/useAgendaData.ts`, linhas 1046–1056) — busca por R1 realizada e marca `leadState = 'completed'`, exibindo o card "R1 JÁ REALIZADA" (`BlockedLeadCard.tsx`).

### Nova regra

> R1 realizada **no mês corrente** continua bloqueando novo R1.
> R1 realizada em **mês anterior** (lead voltando depois) **libera** novo agendamento de R1.

Comparação por **mês + ano** do `meeting_slots.scheduled_at` da R1 realizada versus o mês/ano de **hoje** (timezone São Paulo, alinhado ao resto do sistema).

Casos:

| R1 realizada em | Hoje | Pode reagendar R1? |
|---|---|---|
| Janeiro/2026 | Abril/2026 | ✅ Sim (mês diferente) |
| 02/Abril/2026 | 22/Abril/2026 | ❌ Não (mesmo mês) |
| 30/Março/2026 | 02/Abril/2026 | ✅ Sim (mês diferente) |

Os outros guards permanecem inalterados:
- Contrato pago → continua bloqueando sempre.
- Deal em estágio "won" → continua bloqueando sempre.
- R1 futura ativa (já agendada e não realizada) → continua bloqueando sempre.

### Mudanças

**1. Backend — `supabase/functions/calendly-create-event/index.ts`**

Alterar o guard #4 (linhas 507–530):
- Buscar a R1 completed mais recente do deal trazendo também `meeting_slot.scheduled_at`.
- Se existir e `scheduled_at` estiver no **mesmo mês/ano** que `now()` (em `America/Sao_Paulo`), bloquear com a mensagem atual atualizada: `"Lead já realizou R1 neste mês. Para R2, use a Agenda R2."`.
- Se for de mês anterior, **permitir** o agendamento (não retorna 409).

**2. Frontend — `src/hooks/useAgendaData.ts`**

No bloco que classifica `leadState = 'completed'` (linhas 1046–1056):
- Substituir o `find` simples pela busca da R1 completed **mais recente**, comparando ano+mês com a data atual.
- Se mês/ano = atual → mantém `leadState = 'completed'` e bloqueia (mesma mensagem da regra nova).
- Se mês/ano anterior → `leadState = 'open'` (libera) e expõe um `warningOnly = true` com mensagem informativa: `"Este lead já fez R1 em {mês/ano}. Reagendamento permitido."` para o usuário ter visibilidade.

**3. UI — `src/components/crm/BlockedLeadCard.tsx`**

Atualizar o texto do estado `completed` para refletir a regra: `"R1 já realizada neste mês"` em vez de só `"R1 JÁ REALIZADA"`, e descrição `"Este lead já passou pela Reunião 01 dentro do mês corrente."`.

### Arquivos afetados

- `supabase/functions/calendly-create-event/index.ts` (editar guard #4)
- `src/hooks/useAgendaData.ts` (editar lógica de classificação `completed`)
- `src/components/crm/BlockedLeadCard.tsx` (atualizar copy)

### Observações técnicas

- Sem migration de banco — é só lógica.
- Comparação usa `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric' })` ou equivalente para evitar shifts de timezone (mesma abordagem já usada em outros pontos do projeto).
- Não afeta R2 — R2 já não é bloqueada por R1 realizada.

### Validação pós-deploy

1. Lead com R1 realizada no mês corrente → tentar agendar nova R1 → bloqueio mantido com mensagem nova.
2. Lead com R1 realizada em mês anterior → tentar agendar nova R1 → permitido, com aviso informativo na UI mostrando data da R1 anterior.
3. Lead com R1 futura agendada → bloqueio continua (guard #3 separado).
4. Lead com contrato pago → bloqueio continua (guards #1 e #2).

