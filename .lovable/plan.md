# Encaminhamento Pós-venda → Consórcio: bloquear horários sobrepostos

## O que a verificação mostrou (quinta 19/11, Bruno)
- O sistema **não** cria horários "quebrados" por conta própria: só oferece os horários configurados na agenda do closer.
- A agenda de quinta do Bruno foi **refeita em 16/11** para intervalos de 50 min: 09:30, 10:20, 11:10, 13:00, 13:50, 14:40, **15:30**, 17:10, 18:00, 18:50, 19:40. Então 15:30 é um horário válido dele hoje.
- A reunião das **16:00 (William, ana)** foi marcada em 12/11, quando a quinta ainda tinha horários cheios (15:00, 16:00...). O mesmo vale para a das 09:00 (Kallyane, marcada em 16/11 de manhã, antes da troca).
- O defeito real: ao esconder horários ocupados, o sistema compara só o **horário exato**. Como a reunião das 16:00 dura 60 min, ela ocupa 16:00–17:00, mas também a 15:30 (15:30–16:30) entra em choque — e o sistema não percebeu. Também 14:40 (60 min, até 15:40) choca com 15:30.
- Cleiton tem agenda de hora cheia; o mesmo risco existe se a grade dele mudar.

## O que será feito
1. No agendamento pelo Pós-venda para outra BU, um horário só aparece como livre se **não se sobrepuser** a nenhuma reunião ativa do closer (considerando início + duração), e não só se o horário for diferente.
2. A mesma regra é revalidada no momento de confirmar o agendamento.
3. A duração usada para a nova reunião será a do intervalo da grade do closer naquele dia (ex.: 50 min no Bruno de quarta a sexta), evitando que ela invada o próximo horário. Se não for possível calcular, mantém 60 min.
4. Listar para você os conflitos já existentes nas agendas de Bruno e Cleiton a partir de hoje (como 19/11 15:30 × 16:00), sem cancelar nada — você decide quais remarcar.

Outras agendas e BUs continuam iguais (a regra vale só para o modo exclusivo do encaminhamento).

## Técnico
- `QuickScheduleModal.tsx`: `fetchHorariosOcupados` passa a buscar `scheduled_at, duration_minutes` e retornar intervalos; `timeSlots` filtra por sobreposição `[t, t+dur)` com cada intervalo ocupado; a revalidação no submit usa a mesma função.
- Duração da nova reunião: diferença até o próximo `start_time` do closer no dia (`closerDaySlots`), limitada a 60.
- Consulta somente leitura em `meeting_slots` para os conflitos futuros.
