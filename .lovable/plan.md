

## Closer R2 em apoio agendando R1 como SDR

### Refinamento sobre o plano anterior

O plano anterior cobre **liberação de horários** (criar slots para R1) e badge "Apoio R2" na visão da agenda. Falta o segundo lado: **permitir que esse closer R2, no dia liberado, também opere o fluxo de SDR** — buscar lead, abrir `QuickScheduleModal`, agendar para si mesmo (ou para outro closer disponível). Hoje o code path bloqueia isso porque:

- Em `Agenda.tsx` (linha 40): `isCloser = role === 'closer' && !allRoles.includes('sdr')` → closer puro vê só "Minha Agenda" e não tem busca de lead para agendar; só vê reuniões já marcadas.
- Em `Negocios.tsx` (linha 109): `isRestrictedRole = role === 'sdr' || role === 'closer'` → closer puro vê só os deals próprios, não pode acessar o pipeline para agendar leads novos.
- O botão "Agendar" no header (linha 306) já existe para todos, mas o `QuickScheduleModal` filtra leads pelo `ownerEmail` quando role = sdr; para closer puro hoje ele não consegue acessar leads de SDR.

### Decisão

**Closer R2 com pelo menos 1 entrada ativa em `closer_r1_support_days` válida (data >= hoje) é tratado como SDR temporário no contexto da Agenda R1**, ganhando:

- Botão "Agendar" funcional no `QuickScheduleModal R1` com busca de qualquer lead da BU dele.
- Capacidade de selecionar **qualquer closer R1 disponível** (incluindo ele mesmo nos dias de apoio) para o agendamento.
- Painel "Buscar lead" na própria agenda (igual SDR) — não fica só com a visão "Minha Agenda".
- Acesso de leitura ao pipeline de Negócios da BU (igual SDR) **somente enquanto tiver apoio futuro ativo** — para conseguir abrir um deal e marcar reunião pelo fluxo padrão (`SdrScheduleDialog`).

### Implementação (em cima do plano anterior)

**1. Hook novo `useIsR1SupportActive`**

```ts
// src/hooks/useIsR1SupportActive.ts
// Retorna { isActive: boolean, supportDates: Date[] } para o closer logado.
// isActive = true quando o usuário é closer R2 e existe ao menos 1 entrada
// em closer_r1_support_days com support_date >= hoje vinculada ao employee_id dele.
```

Usa `useMyCloser()` + query em `closer_r1_support_days` filtrando por `closer_id` e `support_date >= today`.

**2. `Agenda.tsx`**

Substituir o cálculo de `isCloser`:

```ts
const { isActive: isR1SupportActive } = useIsR1SupportActive();
const isCloserOnly = role === 'closer' && !allRoles.includes('sdr');
// No modo apoio, comporta como SDR no fluxo de agendamento
const isCloser = isCloserOnly && !isR1SupportActive;
```

Resultado: nos dias com apoio, o closer R2 deixa de cair no branch "Minha Agenda" restrita e passa a ver toda a grade, busca, filtros, e o botão Agendar abre o `QuickScheduleModal` em modo SDR (com `ownerEmail = user.email`).

**3. `QuickScheduleModal.tsx` — busca de leads**

A busca usa `useSearchDealsForSchedule` filtrando por `ownerEmail` quando informado. Para o closer em apoio, passar `ownerEmail = user.email` faz com que ele só veja deals atribuídos a ele — o que é o caso real: SDRs entregam leads a esse closer-em-apoio normalmente, ele só agenda com base nos próprios. Sem mudanças extras.

Caso queiramos permitir **agendar lead de qualquer SDR** durante o dia de apoio (ex.: SDR foi embora no meio do dia), adicionar prop opcional `searchAllOwnersInBU?: boolean`. Quando `true`, o hook ignora `ownerEmail` e busca por toda a BU. Habilitar quando `isR1SupportActive`.

**4. `Negocios.tsx`**

Mesmo princípio: durante apoio ativo, tratar closer como SDR para visibilidade de pipeline da BU dele:

```ts
const { isActive: isR1SupportActive } = useIsR1SupportActive();
const isRestrictedRole = (role === 'sdr' || role === 'closer') && !isR1SupportActive;
```

Com isso, dentro do dia de apoio o closer R2 enxerga o kanban completo, abre o card do lead, clica "Agendar Reunião" → `SdrScheduleDialog` → `QuickScheduleModal` (já existente). Fluxo idêntico ao do SDR, sem código novo.

**5. `CRM.tsx` / `BUCRMLayout.tsx` — navegação**

Mesmo ajuste: `isAgendaOnly` passa a ignorar o closer em modo apoio para que ele consiga clicar nas abas "Negócios" e "Contatos" durante o dia liberado:

```ts
const { isActive: isR1SupportActive } = useIsR1SupportActive();
const isAgendaOnly = role && agendaOnlyRoles.includes(role) && !isR1SupportActive;
```

**6. Reuniões criadas pelo closer-em-apoio**

Quando o closer R2 (em apoio) **agenda** uma R1, o booking grava:
- `booked_by = user.id` do closer R2 (ele é o SDR daquela reunião).
- `closer_id` = quem ele escolheu (geralmente ele mesmo, mas pode ser outro R1 disponível).
- `is_support_booking = true` quando `closer_id === user.closer.id` E o closer escolhido é R2 nativo (igual ao plano anterior).

A trilha em `deal_activities` registra `meeting_scheduled` com metadata `{ booked_by_role: 'closer_apoio', booked_by_closer_id }` — útil para dashboards e auditoria.

**7. Atribuição de SDR nas métricas**

A regra atual (`mem://business-logic/sdr-attribution-hierarchy-v4`) prioriza `booked_by`. Quando `booked_by` é um closer R2 em apoio, ele aparece como "SDR" daquela reunião. Para não distorcer o ranking de SDRs:
- Em `useSdrPerformance` / `TeamGoalsPanel`, ao montar a lista, identificar `booked_by` que pertence a um closer (cruzar com `profiles`/`closers.employee_id`) e renderizar com badge **"Apoio"** ao lado, sem somar na meta de SDR e sem entrar na tabela "SDRs". Aparece numa linha separada **"Apoio comercial"** no painel da BU.

### Arquivos afetados (incremento ao plano anterior)

- **Novo**: `src/hooks/useIsR1SupportActive.ts`
- **Editados**:
  - `src/pages/crm/Agenda.tsx` (cálculo `isCloser` considerando apoio)
  - `src/pages/crm/Negocios.tsx` (cálculo `isRestrictedRole` considerando apoio)
  - `src/pages/CRM.tsx` + `src/pages/crm/BUCRMLayout.tsx` (`isAgendaOnly` considerando apoio)
  - `src/components/crm/QuickScheduleModal.tsx` (prop opcional `searchAllOwnersInBU`, default `false`)
  - `src/hooks/useAgendaData.ts` → `useSearchDealsForSchedule` aceita `ownerEmail = null` para busca BU-wide
  - `src/hooks/useCloserScheduling.ts` (gravar `is_support_booking` + metadata `booked_by_role: 'closer_apoio'`)
  - Hooks de métricas SDR (`useSdrPerformance`, `TeamGoalsPanel`) — separar bookings de apoio em linha própria

### Validação pós-fix

1. Admin libera Rafael (R2) para apoio dia 25/04 → no dia 25/04 Rafael abre `/crm/agenda` e vê grade completa + botão "Agendar" funcional.
2. Rafael clica "Agendar" → `QuickScheduleModal` abre, busca por nome encontra leads dele → seleciona slot → reunião criada com `booked_by = Rafael`, `closer_id = Rafael`, `is_support_booking = true`.
3. Rafael tenta no dia 26/04 (sem apoio) → volta para visão "Minha Agenda" restrita, sem busca de lead, sem botão de agendar.
4. Rafael acessa `/crm/negocios` no dia 25/04 → vê pipeline da BU dele e consegue marcar reunião pelo card; no dia 26 cai no view restrito de closer.
5. Painel comercial → SDRs reais mantêm contagem inalterada; aparece linha "Apoio comercial: Rafael — 3 R1 marcadas" separada.
6. Coordenador libera apoio para closer fora do squad → bloqueado por RLS (mesma regra do plano anterior).

