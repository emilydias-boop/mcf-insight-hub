---
name: Consórcio Vendas Realizadas
description: Vendas Realizadas do Consórcio = clientes distintos na base da Produção Gerada (pernas A+B+C)
type: constraint
---
- Vendas Realizadas = clientes distintos × mês da âncora nas pernas A+B+C da Produção Gerada (mesma base, data e atribuição). Mesmo cliente em pernas diferentes no mesmo mês = 1.
- Ticket Médio = Produção Gerada ÷ Vendas Realizadas. Conv. Vendas/Reunião = Vendas Realizadas ÷ Reuniões Realizadas.
- Aba SDRs: venda vai ao SDR que agendou a R1 de origem (origem_attendee_id → booked_by); sem ela, quem agendou a última R1 do negócio. Total SDRs = Total Closers.
- Cotas Contratadas segue a data de contratação na Embracon. Produção Gerada, Cotas e Efetivado não mudam.
