
# Corrigir "Pendentes Hoje" no Painel Consorcio

## Problema

O KPI "Pendentes Hoje" mostra **30** quando deveria mostrar **0** (a unica reuniao de consorcio hoje ja virou no-show).

O hook `useMeetingsPendentesHoje()` consulta `meeting_slot_attendees` sem nenhum filtro de BU/squad, contando pendentes de TODAS as Business Units (Incorporador, Consorcio, etc.).

## Solucao

Calcular "Pendentes Hoje" a partir dos dados ja filtrados por squad que vem de `useTeamMeetingsData(squad='consorcio')`:

```
pendentesConsorcio = dayKPIs.totalR1Agendada - dayKPIs.totalRealizadas - dayKPIs.totalNoShows
```

Para hoje: `1 - 0 - 1 = 0` pendentes (correto).

## Detalhes tecnicos

### Arquivo: `src/pages/bu-consorcio/PainelEquipe.tsx`

1. **Remover import** de `useMeetingsPendentesHoje` (linha 40)
2. **Remover chamada** `const { data: pendentesHoje } = useMeetingsPendentesHoje()` (linha 280)
3. **Remover** `const dayPendentes = pendentesHoje ?? 0` (linha 408)
4. **Calcular pendentes filtrado** a partir de `dayKPIs`:
```tsx
const pendentesHojeConsorcio = Math.max(0,
  (dayKPIs?.totalR1Agendada || 0) - (dayKPIs?.totalRealizadas || 0) - (dayKPIs?.totalNoShows || 0)
);
```
5. **Passar valor correto** ao `TeamKPICards`:
```tsx
pendentesHoje={pendentesHojeConsorcio}
```
