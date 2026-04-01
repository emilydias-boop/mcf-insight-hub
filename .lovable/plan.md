

## Liberar Dias Extras na Agenda para SDRs

### Problema atual

No `QuickScheduleModal`, SDRs só podem agendar para **hoje e amanhã** (com lógica especial para quinta/sexta/sábado). Essa restrição é hardcoded. Quando um dia enche, coordenadores precisam de uma forma de "liberar" dias adicionais (ex: sexta, segunda) para que os SDRs possam agendar neles.

### Solução

Criar uma configuração de **"Dias Liberados"** na settings do Supabase, editável pelo dialog de "Configurar Closers", que adiciona datas extras às permitidas para SDRs.

### Como funciona

1. **Nova tab "Dias Liberados"** no dialog `CloserAvailabilityConfig` — um calendário simples onde o coordenador clica nas datas que quer liberar (toggle on/off). As datas ficam salvas na tabela `settings` com key `agenda_released_dates_{bu}`.

2. **QuickScheduleModal** consulta essas datas e as inclui nas `allowedDates` e no `disabled()` do calendário, permitindo que SDRs agendem nelas.

### Arquivos

1. **Criar `src/hooks/useAgendaReleasedDates.ts`** — Hook para ler/salvar datas liberadas na tabela `settings` (key: `agenda_released_dates_{bu}`, value: array de strings `yyyy-MM-dd`)

2. **Editar `src/components/crm/CloserAvailabilityConfig.tsx`** — Adicionar nova tab "Dias Liberados" com calendário multi-select. Coordenador clica em datas futuras para liberar/bloquear. Mostra badge nas datas já liberadas.

3. **Editar `src/components/crm/QuickScheduleModal.tsx`** — Importar o hook, adicionar datas liberadas ao cálculo de `allowedDates` (linha 273) e à lógica de `disabled` (linha 935). Se a data está na lista de liberadas, SDR pode agendar nela.

### Detalhes técnicos

```text
// settings table
key: "agenda_released_dates_consorcio"  (ou "agenda_released_dates_incorporador")
value: ["2026-04-03", "2026-04-06", "2026-04-07"]

// No QuickScheduleModal disabled():
// Antes: return !(isToday || isTomorrow);
// Depois: 
const isReleased = releasedDates.includes(format(targetDate, 'yyyy-MM-dd'));
return !(isToday || isTomorrow || isReleased);
```

A tab "Dias Liberados" é global (não por closer), pois libera o dia para agendamento em qualquer closer da BU.

