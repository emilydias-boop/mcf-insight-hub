

## Pre-agendamento com Horario Livre (Sugestao de Encaixe)

### Problema

Hoje o pre-agendamento so permite selecionar horarios ja configurados e disponiveis. O closer quer sugerir "14:00 com Claudia" mesmo que esse horario nao exista na grade. O lead fica esquecido porque depende de alguem abrir o slot primeiro.

### Solucao

Quando o toggle "Pre-agendamento" esta ativo, liberar a selecao de horario para qualquer hora (input livre ou grade completa 08:00-21:00), permitindo que o closer sugira um encaixe. O item aparece na agenda com visual diferenciado (laranja tracejado, como ja existe) e fica na aba "Pre-Agendados" para a coordenadora revisar, abrir o slot se necessario, e confirmar.

### Mudancas

**1. `src/components/crm/R2QuickScheduleModal.tsx`**

- Quando `isPreSchedule = true`:
  - Substituir o `Select` de horario por um input de texto com mascara `HH:mm` (ou um Select com todos os horarios de 08:00 a 21:00 em intervalos de 30min)
  - Remover a restricao `disabled={availableTimeSlots.length === 0}` — sempre permitir selecionar horario
  - Adicionar campo opcional "Preferencia do lead" (textarea curta) para o closer anotar contexto (ex: "Lead so pode as 14h, pedir pra Claudia abrir")
  - Mostrar aviso visual quando o horario escolhido nao esta configurado: badge amarelo "Horario nao configurado — sera encaixe"

- Quando `isPreSchedule = false`: comportamento atual inalterado

**2. `src/hooks/useR2AgendaData.ts` (mutation `useCreateR2Meeting`)**

- Quando `isPreSchedule = true`, passar `bypassCapacity: true` na logica de criacao do slot — ja cria o `meeting_slot` mesmo sem slot configurado (isso ja funciona, pois o insert em `meeting_slots` nao valida contra `r2_daily_slots`)
- Salvar o campo de preferencia do lead em `r2_observations` ou em `notes`

**3. `src/components/crm/R2PreScheduledTab.tsx`**

- Adicionar coluna "Obs/Preferencia" mostrando as observacoes do pre-agendamento
- Adicionar indicador visual quando o horario sugerido NAO tem slot configurado (badge "Sem slot") para a coordenadora saber que precisa abrir o horario antes de confirmar
- Ao confirmar: se o slot nao existe na grade, mostrar alerta "Este horario nao esta configurado. Deseja abrir o slot e confirmar?"

**4. `src/hooks/useR2PreScheduledLeads.ts`**

- Na query, incluir `r2_observations` e `notes` do attendee para exibir na aba
- No `useConfirmR2PreScheduled`, adicionar verificacao: consultar `r2_daily_slots` para ver se o horario ja existe. Se nao existir, criar o slot automaticamente ao confirmar (insert em `r2_daily_slots` com o closer_id, data e horario)

### Fluxo final

```text
Closer R1 → abre modal → marca "Pre-agendamento" → 
  seleciona socio (Claudia) → data (30/03) → 
  digita horario livre (14:00) → 
  ve aviso "Horario nao configurado" → 
  anota "Lead so pode 14h, verificar com Claudia" → 
  clica "Pre-agendar R2"

Agenda R2 → mostra item laranja tracejado no 14:00 da Claudia

Aba Pre-Agendados → Leticia ve o item com badge "Sem slot" → 
  clica Confirmar → sistema cria o slot + confirma o agendamento
```

### O que NAO muda
- Visual dos itens pre-agendados na agenda (laranja tracejado)
- Fluxo de agendamento normal (sem pre-agendamento)
- Cancelamento de pre-agendamento
- Deteccao automatica de Closer R1

