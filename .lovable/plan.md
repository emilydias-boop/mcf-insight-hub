

## Bloquear agendamento duplicado de leads já agendados

### Decisão

Não permitir agendar novamente leads que já tenham R1 ativa no futuro. Sem opção de "agendar mesmo assim". Se precisar mudar horário, é **reagendamento** (no fluxo existente de "Leads da Semana" / drawer da reunião).

### Comportamento por estado do lead

| Estado | Comportamento na busca |
|---|---|
| Sem histórico | Fluxo normal — agenda |
| R1 agendada futura (`invited`/`scheduled` com `scheduled_at > now()`) | **Badge amarelo "📅 Já agendado p/ DD/MM HH:mm c/ [Closer]"** + clique **bloqueado** com toast: "Lead já tem R1 agendada. Use a Agenda para reagendar." |
| R1 realizada (`completed`) | **Badge azul "✅ R1 realizada"** + clique **bloqueado** com toast: "Lead já realizou R1. Para R2, use a Agenda R2." |
| Contrato pago (`contract_paid`) ou deal `won` | **Badge verde "💰 Contrato pago"** + clique **bloqueado** |
| No-show / cancelled / lost | Fluxo normal — pode agendar nova R1 |

### Implementação

**1. `src/hooks/useAgendaData.ts` — `useSearchDealsForSchedule`**
- Estender query para trazer último `meeting_slot_attendee` ativo + `scheduled_at` do `meeting_slot` + `closer.name` + `crm_deals.status` (won/lost).
- Adicionar campo derivado `leadState: 'open' | 'scheduled_future' | 'completed' | 'contract_paid' | 'won'` e `blockReason: string | null` em cada resultado.
- `scheduledInfo: { scheduledAt, closerName } | null` para o badge.

**2. `src/components/crm/QuickScheduleModal.tsx`**
- Renderizar badge de estado na linha do resultado da busca (ao lado do badge de estágio atual).
- Em `handleSelectDeal`: se `leadState !== 'open'` (e não for no-show), **não selecionar** — disparar toast com `blockReason` e abortar.
- Resultados bloqueados ficam com `opacity-60` e cursor `not-allowed` para reforço visual.

**3. `src/components/crm/R2QuickScheduleModal.tsx`**
- Mesma lógica de badges + bloqueio, ajustada ao contexto R2:
  - R2 já agendada futura → bloqueio.
  - Contrato pago → bloqueio.
  - R1 realizada sem R2 → permitido (fluxo normal de R2).

**4. `supabase/functions/calendly-create-event/index.ts` (defesa em profundidade)**
- Antes do insert do attendee, validar que o `deal_id` não tem outro attendee `invited`/`scheduled` com `scheduled_at > now()` para o mesmo `meeting_type`.
- Validar que o `crm_deals.status` não é `won` e que stage não é "Contrato Pago".
- Se violado, retornar `{ error: 'duplicate_active_booking' | 'deal_already_won', message: '...' }` com 409.
- Frontend trata e mostra toast.

### Sem migration

Toda informação já existe em `meeting_slot_attendees`, `meeting_slots`, `crm_deals`, `closers`. Apenas leitura no hook e validação na edge function.

### Validação pós-fix

1. Buscar **Herbert Viana** no QuickScheduleModal R1 → badge amarelo "📅 Já agendado p/ 22/04 17:45 c/ Rafael", clique não seleciona, toast informativo.
2. Buscar **Giovani Tomazini** (contrato pago) → badge verde, clique bloqueado.
3. Buscar lead novo → fluxo normal, sem badge.
4. Lead com `no_show` recente → continua agendável (badge informativo opcional, mas sem bloqueio).
5. Tentar burlar via API direta na edge function → 409 com mensagem clara.

### Arquivos afetados

- `src/hooks/useAgendaData.ts`
- `src/components/crm/QuickScheduleModal.tsx`
- `src/components/crm/R2QuickScheduleModal.tsx`
- `supabase/functions/calendly-create-event/index.ts`

