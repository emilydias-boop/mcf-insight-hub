## Bug — Agenda R2 / Pré-agendamento

A Jéssica Bellini está cadastrada como **R1 Closer** (`closers.meeting_type = 'r1'`). Quando ela abre o modal de agendar R2, o sistema entra automaticamente em **modo pré-agendamento** (`isPreSchedule = true`).

Nesse modo, o `R2QuickScheduleModal` **descarta a grade real do closer** e gera uma lista artificial só com horários `:00` e `:30` (09:00 → 20:00). Por isso, **13:45** (slot nativo configurado para Jessica Martins) **nunca aparece** no select para ela, mesmo estando livre.

Resultado prático: R1 Closers só conseguem pré-agendar nos slots arredondados, e ficam impedidos de aproveitar horários reais como 13:45, 14:30, 15:15 etc. — todos os slots "quebrados" da agenda do closer.

## Causa exata no código

Em `src/components/crm/R2QuickScheduleModal.tsx`:

```text
isPreSchedule (auto = true para R1 Closer)
   └─ select de horário usa allFreeTimeSlots (09:00..20:00 :00/:30)
      em vez de allConfiguredSlots (slots reais do closer)
```

A grade real (`closerSlots.availableSlots`) já vem corretamente do hook `useR2CloserAvailableSlots`, com `currentCount`, `maxCount` e `preScheduledCounts` — só não está sendo usada quando `isPreSchedule = true`.

## Correção proposta

1. **Unificar a fonte de horários no modal R2**, mesmo em modo pré-agendamento:
   - Sempre exibir `allConfiguredSlots` (grade real do closer).
   - Em pré-agendamento, **não desabilitar** slots por capacidade do agendamento normal: aplicar a regra de pré-agendamento (limite `MAX_PRE_SCHEDULE_PER_SLOT = 2` via `preScheduledCounts`) sobre a mesma grade.
   - Marcar como "(encaixe)" quando o slot já tem agendamento normal mas ainda cabe pré-agendamento; "(ocupado)" só quando atingiu o teto de pré-agendamentos.

2. **Manter o fallback de "horário livre"** para casos em que o closer não tem slot configurado naquele dia: oferecer um botão/seção "Outro horário" que abre os `:00/:30` de 09:00–20:00 — assim a Bellini ainda consegue pré-agendar fora da grade quando precisar, mas a grade real é a opção primária.

3. **Não mexer** em:
   - Capacidade `max_leads_per_slot` da Jessica Martins.
   - Lógica de detecção de R1 Closer (`useR2Bookers`).
   - Fluxo de confirmação de pré-agendamento.

## Arquivo a tocar

- `src/components/crm/R2QuickScheduleModal.tsx` — ajustar a montagem da lista de horários quando `isPreSchedule = true` para usar `allConfiguredSlots` como base, com a regra de capacidade de pré-agendamento.

## Validação após a correção

- Logada como Jéssica Bellini, abrir agendar R2 → Closer Jessica Martins → 07/05 → confirmar que **13:45 aparece** no select como disponível para pré-agendar.
- Repetir para Edvaldo Soares Serafim → conseguir concluir o pré-agendamento.
- Verificar que slot 13:00 (já ocupado) continua marcado como "(ocupado)" / "(encaixe)" coerente com o limite de 2 pré-agendamentos.
- Logada como SDR não-R1-closer: comportamento atual preservado (grade real, capacidade normal).
