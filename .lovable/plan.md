
# Ajustar Semana Segunda-Domingo em TODOS os Componentes CRM da BU Consorcio

## Problema

A agenda e demais paginas CRM compartilhadas (Agenda R1, Agenda R2, Metricas, Reunioes Equipe, etc.) continuam usando Sabado-Sexta (`WEEK_STARTS_ON = 6`) mesmo quando acessadas pela rota `/consorcio/crm/*`. A imagem mostra a agenda comecando no Sabado 21, quando deveria comecar na Segunda 23.

## Solucao

Criar uma funcao helper `getWeekStartsOn(activeBU)` que retorna `1` para Consorcio e `6` para as demais BUs. Usar essa funcao em todos os componentes CRM compartilhados que calculam datas de semana.

---

## Arquivos a modificar

### 1. `src/lib/businessDays.ts` - Helper de decisao

Adicionar funcao utilitaria:

```text
export function getWeekStartsOn(activeBU: string | null): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  if (activeBU === 'consorcio') return CONSORCIO_WEEK_STARTS_ON;
  return WEEK_STARTS_ON;
}
```

Isso centraliza a logica e evita repetir `if consorcio` em cada arquivo.

### 2. `src/pages/crm/Agenda.tsx` (Agenda R1)

- Ja tem `activeBU` via `useActiveBU()`
- Trocar `WEEK_STARTS_ON` por `getWeekStartsOn(activeBU)` nas linhas 63-64 (calculo de rangeStart/rangeEnd da semana)

### 3. `src/components/crm/AgendaCalendar.tsx` (Calendario visual)

- Ja tem `activeBU` via `useBUContext()`
- Trocar `WEEK_STARTS_ON` nas linhas 80, 121, 692 por `getWeekStartsOn(activeBU)`
- Linha 102: trocar ordem dos dias `[6, 0, 1, 2, 3, 4, 5]` para dinamicamente calcular baseado no weekStartsOn (para Consorcio sera `[1, 2, 3, 4, 5, 6, 0]`)

### 4. `src/pages/crm/AgendaR2.tsx` (Agenda R2)

- Ja tem `activeBU` via `useActiveBU()`
- Trocar `WEEK_STARTS_ON` nas linhas 119-120 por `getWeekStartsOn(activeBU)`

### 5. `src/pages/crm/AgendaMetricas.tsx`

- Ja tem `activeBU` via `useActiveBU()`
- Trocar `WEEK_STARTS_ON` nas linhas 22-23 por `getWeekStartsOn(activeBU)`

### 6. `src/pages/crm/ReunioesEquipe.tsx`

- Verificar se tem `activeBU`; se nao, adicionar `useActiveBU()`
- Trocar `WEEK_STARTS_ON` nas linhas 136, 162-163 por `getWeekStartsOn(activeBU)`

### 7. `src/pages/crm/CloserMeetingsDetailPage.tsx`

- Adicionar `useActiveBU()` se nao tiver
- Trocar `WEEK_STARTS_ON` nas linhas 35-36 por `getWeekStartsOn(activeBU)`

### 8. `src/pages/crm/SdrMeetingsDetailPage.tsx`

- Adicionar `useActiveBU()` se nao tiver
- Trocar `WEEK_STARTS_ON` nas linhas 43 por `getWeekStartsOn(activeBU)`

### 9. `src/components/crm/R2MetricsPanel.tsx`

- Usa `getCustomWeekStart/End` (Sabado-Sexta)
- Verificar se tem acesso a BU; se for consorcio, usar `startOfWeek(now, { weekStartsOn: 1 })` em vez de `getCustomWeekStart`

---

## O que NAO muda

- Constantes `WEEK_STARTS_ON = 6` e `CONSORCIO_WEEK_STARTS_ON = 1` permanecem
- Paginas que nao sao CRM compartilhado (dashboard geral, financeiro, receita) continuam Sabado-Sexta
- `dateHelpers.ts` (`getCustomWeekStart/End`) continua Sabado-Sexta para uso geral
- `PainelEquipe.tsx` e `ConsorcioPeriodFilter.tsx` ja foram atualizados anteriormente

## Detalhes tecnicos

### Helper `getWeekStartsOn`

Recebe o `activeBU` (string | null) e retorna o valor correto para `weekStartsOn` do `date-fns`. Isso e importado em cada componente junto com os imports existentes de `businessDays.ts`.

### Ordem dos dias no calendario visual

Hoje o `AgendaCalendar` tem hardcoded `[6, 0, 1, 2, 3, 4, 5]` para Sabado-Domingo. Para Consorcio, precisa ser `[1, 2, 3, 4, 5, 6, 0]` (Segunda-Domingo). A logica sera:

```text
const daysOrder = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
```

### Sequencia de implementacao

1. Adicionar `getWeekStartsOn()` em `businessDays.ts`
2. Atualizar `AgendaCalendar.tsx` (componente visual compartilhado - maior impacto)
3. Atualizar `Agenda.tsx` (pagina R1)
4. Atualizar `AgendaR2.tsx` (pagina R2)
5. Atualizar `AgendaMetricas.tsx`
6. Atualizar `ReunioesEquipe.tsx`
7. Atualizar `CloserMeetingsDetailPage.tsx`
8. Atualizar `SdrMeetingsDetailPage.tsx`
9. Verificar `R2MetricsPanel.tsx`
