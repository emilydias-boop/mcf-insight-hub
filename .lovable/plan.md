

# Botao "Reagendar" para Leads em No-Show

## Problema

Quando o lead esta em estagio de No-Show, o botao mostra "Agendar" mas deveria mostrar "Reagendar", pois ja houve uma reuniao anterior. Sem limite de reagendamentos -- o SDR pode reagendar quantas vezes quiser. Para a meta do SDR, conta o 1o agendamento + o 1o reagendamento.

## Solucao

Alteracao simples no `QuickActionsBlock.tsx`:

1. Derivar flag `isNoShowStage` a partir do nome do estagio do deal
2. Alterar o texto do botao de "Agendar" para "Reagendar" quando no-show
3. Passar flag `isReschedule` para o `SdrScheduleDialog` para ajustar os textos do modal

## Detalhes Tecnicos

### Arquivo: `src/components/crm/QuickActionsBlock.tsx`

- Importar `CalendarClock` do lucide-react
- Adicionar logica de deteccao:

```text
const stageName = deal?.crm_stages?.stage_name?.toLowerCase() || '';
const isNoShowStage = stageName.includes('no-show') || stageName.includes('no_show') || stageName.includes('noshow');
```

- No botao de agendar (linha 211-219):
  - Icone: `CalendarClock` quando no-show, `Calendar` caso contrario
  - Texto: "Reagendar" quando no-show, "Agendar" caso contrario
  - Cor: borda amber quando no-show para diferenciar visualmente

- Passar `isReschedule={isNoShowStage}` para o `SdrScheduleDialog`

### Arquivo: `src/components/crm/SdrScheduleDialog.tsx`

- Adicionar prop `isReschedule?: boolean`
- Alterar titulo: "Reagendar Reuniao" quando `isReschedule`
- Alterar descricao: "Reagendar reuniao para {contactName}"

Nenhuma restricao de quantidade -- o botao estara sempre ativo independente de quantos reagendamentos ja foram feitos.
