# Investigação: modal "Configurar Closers" não aparece para closer (ELNATHAN)

## 1. Onde está o modal e o gatilho

- Modal: `src/components/crm/CloserAvailabilityConfig.tsx` — título "Configurar Closers" (linha 494), abas "Disponibilidade" / "Datas Bloqueadas" / "Dias Liberados" (linhas 527-531). Dentro da aba Disponibilidade: "Cor do Closer" (224), "Leads por Reunião" (276) e a grade por dia com horário + link do Meet gravando em `closer_meeting_links` (via `src/hooks/useCloserMeetingLinks.ts`).
- Quem renderiza: página `src/pages/crm/Agenda.tsx` (Agenda R1) — modal montado na linha 751, estado `configOpen` (linha 67).
- Existem TRÊS gatilhos:
  1. Botão "Configurar" no cabeçalho — `Agenda.tsx:415`.
  2. Engrenagem no cabeçalho da grade semanal — `src/components/crm/AgendaCalendar.tsx:1086` (`onEditHours`, passado em `Agenda.tsx:698`).
  3. Engrenagem no cabeçalho da visão por closer — `src/components/crm/CloserColumnCalendar.tsx:314` (`onEditHours`, passado em `Agenda.tsx:733`).
- Equivalente R2: `R2CloserAvailabilityConfig` em `src/pages/crm/AgendaR2.tsx:932`, botão "Closers" em `AgendaR2.tsx:506`.

## 2. Condição literal que decide a exibição

`src/pages/crm/Agenda.tsx:409`

```tsx
{!isCloser && ( ... botão Métricas + botão Configurar ... )}
```

com (linhas 57-59):

```tsx
const isCloserOnly = role === 'closer' && !allRoles.includes('sdr');
const isCloser = isCloserOnly && !isR1SupportActive;
```

Ou seja: a condição é puramente de papel. `profiles.can_manage_agenda`, `useMyAgendaCapabilities`, `useMyPermissions`/`useUserPermissions` e BU **não são consultados em nenhum ponto** de `Agenda.tsx` para esse botão. Em R2 é o mesmo padrão: `AgendaR2.tsx:495` usa `{!isR2Closer && ...}`.

Observação importante: as engrenagens dentro das grades (`onEditHours`) são passadas **sem condição** (`Agenda.tsx:698` e `:733`), então hoje o closer consegue abrir o mesmo modal por elas — o botão do cabeçalho é o único escondido. É uma inconsistência de permissão, não um bloqueio efetivo.

## 3. Quais closers aparecem nas abas do topo do modal

`Agenda.tsx:754` passa `closers={closers}` — a lista **completa**, não a `filteredClosers` (que restringe o closer à própria coluna). `closers` vem de `useClosersWithAvailability(activeBU, { includeInactiveWithMeetingsRange })` (`Agenda.tsx:130`), que em `src/hooks/useAgendaData.ts:372-412` traz: closers `is_active = true`, com `meeting_type` nulo ou `r1`, filtrados por `bu = activeBU`, mais closers inativos que tenham reunião no período visível. Daí o print mostrar Elnathan e Jessica Bellini (BU solar), e não apenas o próprio usuário.

## 4. O closer consegue abrir hoje?

- Botão "Configurar" do cabeçalho: **não**, barrado por `!isCloser` em `Agenda.tsx:409`. O `can_manage_agenda = true` do Elnathan é ignorado nesse ponto.
- Engrenagem na grade: **sim**, abre o modal (não há gate).
- Mas gravar depende do RLS, e aqui está o bloqueio real:
  - `closer_availability` → ALL só para `admin` ou `coordenador` (policy "Admins and coordenadores can manage availability"); closer só tem SELECT.
  - `closer_blocked_dates` → mesma regra.
  - `closers` (cor, duração) → mesma regra.
  - `closer_meeting_links` → INSERT/UPDATE/DELETE liberados para qualquer `authenticated`.
  
  Portanto, mesmo entrando pela engrenagem, o Elnathan consegue salvar apenas os links/horários de `closer_meeting_links`; cor, duração, leads por reunião e datas bloqueadas falham silenciosamente por RLS.
- Dados do Elnathan: `profiles.can_manage_agenda = true`, papel único `closer`. Existem **duas linhas em `closers`** com o mesmo `employee_id`: `a4a1726f…` (bu `solar`, ativa) e `f3b0422a…` (bu nula, inativa) — a duplicata pode causar ruído na seleção/vínculo.

## 5. Existe auto-serviço para o closer?

Não. As telas de configuração de agenda são `/crm/configurar-closers` (guard `ResourceGuard resource="configuracoes"`), `/crm/configurar-closers-r2` (`RoleGuard admin/manager/coordenador`) e este modal na Agenda R1/R2. Nenhuma rota ou componente permite ao closer editar a própria disponibilidade de forma própria; `useMyAgendaCapabilities` (`src/hooks/useMyAgendaCapabilities.ts`) já expõe `canManageAgenda`, mas nada em Agenda/AgendaR2 o consome.

## Opções de correção (nada implementado ainda)

**Opção A — liberar o modal existente por capacidade (menor esforço)**
- Trocar `{!isCloser && ...}` por algo como `{(!isCloser || canManageAgenda) && ...}` usando `useMyAgendaCapabilities`.
- Limitar as abas do topo ao próprio closer quando não for liderança (passar `filteredClosers` nesse caso), para ele não editar agenda de colegas.
- Requer ajuste de RLS: políticas de `closer_availability`, `closer_blocked_dates` e update de `closers` permitindo o dono (`closers.employee_id`/e-mail = usuário logado) quando `can_manage_agenda`. Sem isso, salvar cor/duração/bloqueios continua falhando.

**Opção B — tela dedicada "Minha Agenda · Horários" (auto-serviço)**
- Rota nova para role `closer` com o closer fixo no próprio vínculo (`useMyCloser`), reaproveitando o formulário atual.
- Mesma necessidade de RLS por dono; mais seguro por construção (sem seletor de outros closers).

**Opção C — só links de reunião (mínimo risco)**
- Liberar ao closer apenas a grade de horário + link do Meet (`closer_meeting_links`, já gravável por `authenticated`), mantendo cor/duração/leads/bloqueios sob liderança. Atende "cadastrar horários e links para dias futuros" sem tocar em RLS.

**Higiene recomendada em qualquer opção**
- Fechar a brecha inversa: as engrenagens `onEditHours` hoje abrem o modal para qualquer um; passar `onEditHours` só quando houver permissão.
- Decidir o que fazer com a linha duplicada inativa de `closers` do Elnathan (`f3b0422a…`, bu nula) — só mediante autorização explícita.
