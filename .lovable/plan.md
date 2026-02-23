
# Alterar Semana da BU Consorcio para Segunda a Domingo

## Resumo

Atualmente todas as BUs usam semana de Sabado a Sexta (weekStartsOn: 6). A BU Consorcio precisa passar a usar Segunda a Domingo (weekStartsOn: 1), sem afetar as demais BUs.

---

## Arquivos a modificar

### 1. `src/lib/businessDays.ts` - Exportar constante para Consorcio

Adicionar nova constante:

```text
export const CONSORCIO_WEEK_STARTS_ON = 1; // Segunda-feira
```

Isso mantem a constante `WEEK_STARTS_ON = 6` intacta para as demais BUs.

### 2. `src/hooks/useConsorcioPipelineMetrics.ts`

Trocar o import de `WEEK_STARTS_ON` por `CONSORCIO_WEEK_STARTS_ON` (valor 1).

Linhas afetadas: 4, 76, 77 - onde calcula weekStart e weekEnd para metricas do pipeline de consorcio.

### 3. `src/components/consorcio/ConsorcioPeriodFilter.tsx`

Trocar as chamadas `getCustomWeekStart/End` (que usam Sabado-Sexta) por `startOfWeek/endOfWeek` com `weekStartsOn: 1` (Segunda-Domingo).

Linhas afetadas: 13, 48-49, 53-55 - nos botoes "Esta Semana" e "Semana Anterior".

### 4. `src/pages/bu-consorcio/PainelEquipe.tsx`

Trocar todas as referencias `weekStartsOn: 6` e `WEEK_STARTS_ON` por `CONSORCIO_WEEK_STARTS_ON` (1).

Linhas afetadas:
- 64-65: `ConsorcioMetricsCard` (wStart/wEnd para summary)
- 209: `getDateRange()` preset "week"
- 229-230: weekStartDate/weekEndDate para metricas do time

### 5. `src/hooks/useSetoresDashboard.ts`

Este hook e compartilhado entre todas as BUs, mas os setores `efeito_alavanca` e `credito` sao especificos da BU Consorcio.

A abordagem mais segura: calcular um segundo par de datas de semana (Segunda-Domingo) especificamente para as queries de `consortium_cards` e `consortium_payments`, mantendo Sabado-Sexta para os demais setores (incorporador, projetos, leilao).

Mudancas:
- Adicionar `consorcioWeekStart` e `consorcioWeekEnd` com `weekStartsOn: 1`
- Usar essas datas nas queries de `consortium_cards` (weekly) e `consortium_payments` (weekly) e `consortium_installments` (weekly)
- Manter as datas originais (Sabado-Sexta) para queries de `hubla_transactions`
- Atualizar o `semanaLabel` para mostrar o range correto por setor (ou manter o label global como Sabado-Sexta, ja que e o dashboard geral)

---

## O que NAO muda

- `WEEK_STARTS_ON = 6` continua existindo e sendo usada por todas as outras BUs
- `getCustomWeekStart/End` em `dateHelpers.ts` continua Sabado-Sexta (usado por dashboard geral, agenda, carrinho R2, etc.)
- Hooks de Agenda (`useAgendaData`), Reunioes Equipe, SDR, Closer, Transacoes - todos continuam Sabado-Sexta
- `useIncorporadorGrossMetrics` continua Sabado-Sexta

---

## Detalhes tecnicos

### Constante nova em `businessDays.ts`

```text
CONSORCIO_WEEK_STARTS_ON = 1  // Segunda-feira (Monday)
```

Com `date-fns`, `startOfWeek(date, { weekStartsOn: 1 })` retorna segunda-feira e `endOfWeek(date, { weekStartsOn: 1 })` retorna domingo.

### Sequencia de implementacao

1. Adicionar constante em `businessDays.ts`
2. Atualizar `useConsorcioPipelineMetrics.ts`
3. Atualizar `ConsorcioPeriodFilter.tsx`
4. Atualizar `PainelEquipe.tsx`
5. Atualizar `useSetoresDashboard.ts` (queries de consorcio)
