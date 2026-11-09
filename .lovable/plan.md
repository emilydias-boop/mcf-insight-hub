# Reagendar reunião na Agenda do Pós-venda

## Como está hoje (verificado, nada alterado)
- Busca: o campo "Buscar cliente..." existe, mas só procura dentro do período que está na tela (dia, semana ou mês). Uma reunião de outro mês só aparece se você navegar até ele.
- Reagendar: não existe. Ao abrir uma reunião, dá para mudar só o Status (Agendada, Realizada, No-show, Cancelada) e a Observação. Não dá para trocar a data nem o horário.
- O que dá para fazer hoje: marcar a reunião como Cancelada (o convite do cliente é removido) e depois agendar uma nova pelo botão de nova reunião. Assim o cliente recebe outro convite.

## Proposta (se quiser)
1. Botão "Reagendar" na janela da reunião, só para reuniões Agendadas que ainda não aconteceram.
2. Escolher a nova data e o novo horário, com os mesmos horários livres do gerente que aparecem ao agendar.
3. Ao salvar, o horário muda e o convite no Google Agenda é atualizado: cancela o convite antigo e envia um novo ao cliente.
4. A observação registra "Reagendada de DD/MM HH:mm".
5. Opcional: buscar o cliente nas próximas reuniões, sem depender do período que está na tela.

## Detalhes técnicos
- Fica em AgendaPosVenda.tsx (ReuniaoDialog). Usa um update de `inicio` em pos_venda_reunioes, validado pelos horários de pos_venda_disponibilidade.
- O convite é atualizado com syncConvitePosVenda: primeiro 'cancel', depois 'create'. A função pos-venda-calendar-sync não muda.
