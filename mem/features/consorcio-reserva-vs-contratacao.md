---
name: Consórcio Reserva vs Contratação
description: Cotas de consórcio têm tipo_registro reserva|contratacao com data_reserva e data_contratacao; reservas geram parcelas com status 'previsto'.
type: feature
---
Cotas de consórcio (`consortium_cards`) têm dois estados de cadastro:

- **tipo_registro = 'reserva'**: cota acordada mas 1ª parcela não paga.
  - Obrigatório: `data_reserva`. `data_contratacao` opcional.
  - Parcelas geradas com status **'previsto'** (cronograma é só previsão).
- **tipo_registro = 'contratacao'**: 1ª parcela paga.
  - Obrigatório: `data_contratacao`. `data_reserva` opcional.
  - Parcelas geradas como pendente/pago normalmente.

Constraint `consortium_cards_datas_consistencia_check` garante a regra.
Hook `useCreateConsorcioCard` escolhe a data base conforme `tipo_registro`.
KPIs em `useConsorcioPagamentos` separam: totalRecebido, totalPendente, totalAtraso, **totalPrevisto**, e cotasReservadas.