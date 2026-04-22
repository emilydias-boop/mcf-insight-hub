

## Liberar fluxo R2 — manter trava só na R1

### Decisão

A trava de bloqueio (card grande + botão "Fechar") foi pensada **para a R1**. Na R2 ela está atrapalhando casos legítimos:

- Lead com **R1 realizada** quer marcar R2 → era o caso *normal* de R2, e está bloqueado.
- Lead com **contrato pago** pode precisar de R2 (reunião de pós-venda / acompanhamento).
- Lead com **R2 anterior no-show** precisa poder reagendar nova R2.

### Comportamento corrigido por contexto

**R1 (`QuickScheduleModal`)** → sem mudança. Mantém todo o bloqueio:
- R1 futura agendada → bloqueia (card amarelo + "Fechar")
- R1 já realizada → bloqueia
- Contrato pago / won → bloqueia

**R2 (`R2QuickScheduleModal`)** → liberar tudo, exceto aviso suave de duplicata:
- R1 realizada / open / no-show → **fluxo normal**, sem badge, sem card
- Contrato pago / won → **fluxo normal**, sem bloqueio (R2 pós-venda permitido)
- R2 futura agendada → **continua selecionável**, mostra:
  - Badge amarelo na busca: "📅 R2 já agendada p/ DD/MM HH:mm c/ Closer"
  - **Banner informativo** acima do form (não substitui notas, não bloqueia botão): "Este lead já tem R2 agendada com X. Você pode criar outra R2 ou reagendar a existente pela Agenda."
  - Botão continua "Agendar Reunião R2" (verde, ativo)
- R2 anterior no-show / completed → fluxo normal

### Implementação

**1. `src/hooks/useAgendaData.ts` — `useSearchDealsForSchedule`**

No bloco onde `meetingType === 'r2'`, simplificar drasticamente:
- Remover bloqueio por `contract_paid` e `won` quando `meetingType === 'r2'`.
- Manter detecção de **R2 futura ativa** apenas para mostrar **info na UI**, mas mudar o `leadState` retornado de `'scheduled_future'` para algo como `'r2_duplicate_warning'` (ou marcar `blockReason = null` e expor `warningMessage` separado).

Mais limpo: introduzir um campo extra `warningOnly: boolean` ao lado de `leadState`. Quando `meetingType === 'r2'` e existe R2 futura, retorna:
```ts
{ leadState: 'open', warningOnly: true, scheduledInfo: {...}, warningMessage: '...' }
```
Assim o R2 modal trata diferente de R1 sem precisar de novo enum.

**2. `src/components/crm/R2QuickScheduleModal.tsx`**

- Remover lógica de `isLeadBlocked` / `blockedLeadState` / `BlockedLeadCard` — não mostrar mais o card grande nem trocar botão para "Fechar".
- Substituir por um **alert banner amarelo compacto** (ex: usando `Alert` de `@/components/ui/alert`) renderizado acima dos campos do form, condicional a `selectedDeal?.warningOnly`:
  ```
  ⚠️ Este lead já tem R2 agendada para 22/04 às 16:00 com Rafael.
     Você pode criar outra R2 ou reagendar a existente pela Agenda.
  ```
- Form completo e botão "Agendar Reunião R2" continuam ativos.
- Badge na lista de resultados continua aparecendo (mesma cor amarela, texto "R2 já agendada"), mas item **não fica `opacity-70`** e não tem borda lateral grossa — apenas badge informativo.

**3. `src/hooks/useR2AgendaData.ts` — `useCreateR2Meeting`**

Remover ambos os guards (`paid` e `activeFuture`). R2 não bloqueia no client-side. Usuário fica responsável pelo aviso visual.

**4. `supabase/functions/calendly-create-event/index.ts`**

Aplicar guards (deal_already_won / paid / duplicate / r1_completed) **somente quando `body.meetingType !== 'r2'`** (i.e., R1). Hoje os guards 1, 2 e 3 rodam para qualquer `meetingType`. Solução: envolver os guards 1, 2, 3 dentro de `if (guardMeetingType === 'r1') { ... }`. O guard 4 (R1 completed) já está restrito a R1.

> Observação: a R2 do projeto não passa pela edge `calendly-create-event` (usa `useCreateR2Meeting` diretamente no Supabase). Mesmo assim ajusto a edge function por segurança/consistência caso algum dia o R2 seja roteado por ela.

**5. `src/components/crm/QuickScheduleModal.tsx` (R1)**

Sem mudança. O comportamento atual de R1 (card grande "LEAD JÁ AGENDADO" + botão "Fechar") permanece igual — é o que o usuário quer.

### Arquivos afetados

- `src/hooks/useAgendaData.ts` — adicionar `warningOnly` + simplificar lógica para R2.
- `src/components/crm/R2QuickScheduleModal.tsx` — remover BlockedLeadCard/Fechar, adicionar Alert banner suave.
- `src/hooks/useR2AgendaData.ts` — remover guards de `useCreateR2Meeting`.
- `supabase/functions/calendly-create-event/index.ts` — guards 1, 2, 3 só para R1.

### Validação pós-fix

1. R2: buscar lead com **R1 realizada** → fluxo normal, sem badge, sem aviso, agenda direto. ✅
2. R2: buscar lead com **contrato pago** → fluxo normal, agenda R2 (pós-venda). ✅
3. R2: buscar lead com **R2 já agendada futura** → badge amarelo na lista, ao selecionar mostra banner amarelo de aviso, mas form completo + botão "Agendar Reunião R2" funcionam. ✅
4. R2: buscar lead com **R2 anterior no-show** → fluxo normal. ✅
5. R1: buscar lead **já agendado** → continua mostrando card grande "LEAD JÁ AGENDADO" + botão "Fechar". ✅ (sem regressão)
6. R1: buscar lead com **R1 realizada** → continua bloqueado com card azul. ✅
7. R1: buscar lead com **contrato pago** → continua bloqueado com card verde. ✅

