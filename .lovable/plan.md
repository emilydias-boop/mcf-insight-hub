
# Ocultar Domingo quando nao houver reunioes ou slots configurados

## Problema

Domingo agora aparece sempre na grade da agenda, mesmo quando nao ha reunioes nem horarios configurados. Isso desperica espaco e confunde a visualizacao.

## Solucao

Tornar a inclusao do Domingo dinamica: so exibir a coluna quando houver pelo menos uma reuniao agendada OU um slot de disponibilidade configurado para aquele Domingo especifico.

## Alteracao

### Arquivo: `src/components/crm/AgendaCalendar.tsx`

1. No `viewDays` (linhas 219-238): calcular o Domingo da semana e verificar se ha dados antes de incluir
   - Checar se alguma reuniao em `meetings` cai naquele Domingo
   - Checar se ha slots configurados (via `r2DailySlotsMap` para R2 ou `meetingLinkSlots` para R1)
   - Se nenhum dos dois existir, excluir o Domingo do array

2. No `daysOfWeekInView` (linhas 98-105): tambem condicionar a inclusao do dia 0 (Domingo) a existencia de dados, para que os slots de horario tambem nao busquem dados desnecessarios

A logica sera:

```text
const sundayDate = addDays(weekStart, 1);
const hasSundayMeetings = meetings.some(m => isSameDay(parseISO(m.scheduled_at), sundayDate));
const hasSundaySlots = (R2: r2DailySlotsMap tem slots para esse domingo) 
                    OU (R1: meetingLinkSlots tem slots para day_of_week 0);

const includeSunday = hasSundayMeetings || hasSundaySlots;
```

Se `includeSunday` for false, o array `viewDays` tera 6 dias (Sab, Seg, Ter, Qua, Qui, Sex) como antes.

## Resultado

- Semanas normais: 6 colunas (sem Domingo) -- visual identico ao anterior
- Semanas com Domingo ativo: 7 colunas (com Domingo visivel)
- Transicao automatica, sem configuracao manual
