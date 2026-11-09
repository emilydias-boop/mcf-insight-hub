# Desfazer agendamentos em conflito no Consórcio

## O que encontrei
Três agendamentos vieram do Pós-venda para o Consórcio. Todos estão com o closer Bruno de Souza Albuquerque, em 10/11:

| Cliente | Horário | Situação |
|---|---|---|
| José Roberto Vieira Guimarães | 14:00 | Conflito: o horário já era do Samuel Gracino de Souza, lead do próprio Consórcio |
| Diego Luiz Colognesi | 15:00 | OK: foi o primeiro a ocupar o horário |
| José Roberto Vieira Guimarães | 15:00 | Conflito: entrou depois do Diego no mesmo horário (e José já estava às 14:00) |

Encontrei só esses dois casos de conflito, os dois do José.

## O que será feito
1. Tirar o José dos dois horários (14:00 e 15:00). Ele fica marcado como cancelado nessas reuniões, então o histórico continua registrado.
2. Samuel continua sozinho às 14:00 e Diego sozinho às 15:00. As reuniões deles não mudam.
3. O cartão do José no Consórcio continua existindo. O gerente agenda de novo pelo "Agendar em outra BU", que agora só mostra horários livres.
4. Conferir no banco que nenhum horário do Bruno ficou com mais de um cliente vindo do Pós-venda.

## Detalhes técnicos
- Alterar o status das participações `d0bb09a0-…` (horário c10d6fdd, 14:00) e `65445192-…` (horário 209eeaa9, 15:00) para `cancelled`. A alteração é feita direto no banco, sem apagar nada e sem mexer nas reuniões.
- Nenhuma mudança em telas ou regras.
