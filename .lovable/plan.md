
# Ocultar Dias Sem Horarios Configurados na Agenda

## Problema

A agenda semanal mostra todos os 7 dias da semana, mesmo quando Sabado e Domingo (ou qualquer outro dia) nao tem nenhum horario configurado nem reuniao agendada. Isso desperica espaco visual.

## Solucao

Substituir a logica atual `includeSunday` (que so esconde o Domingo condicionalmente) por uma logica generalizada que filtra QUALQUER dia sem slots configurados e sem reunioes.

## Arquivo a modificar

### `src/components/crm/AgendaCalendar.tsx`

**1. Substituir `includeSunday` por `daysWithContent`** (linhas 219-245)

Criar um `useMemo` que, para cada dia da semana, verifica se:
- Tem alguma reuniao agendada nesse dia, OU
- Tem slots configurados (R1 via `meetingLinkSlots[dayOfWeek]` ou R2 via `r2DailySlotsMap[dateStr]`)

Se nenhum dos dois existir, o dia e excluido da visualizacao.

**2. Atualizar `viewDays`** (linhas 247-264)

Em vez de verificar apenas `includeSunday`, filtrar os dias usando o Set `daysWithContent`.

Logica:

```text
// Para cada dia da semana no range:
//   - Verifica se meetingLinkSlots[dayOfWeek] tem slots (R1)
//   - Verifica se r2DailySlotsMap[dateStr] tem slots (R2)
//   - Verifica se alguma reuniao existe nesse dia
//   Se nenhum, exclui o dia
```

**Importante**: Manter o fallback de mostrar pelo menos os dias uteis (Seg-Sex) caso NENHUM dia tenha slots, para evitar uma agenda completamente vazia.

## O que NAO muda

- Modo "dia" e "mes" continuam mostrando todos os dias normalmente
- A logica de `timeSlots` (horarios verticais) continua dinamica
- Nenhuma outra BU e afetada - a logica se aplica ao componente compartilhado e funciona para todas as BUs
