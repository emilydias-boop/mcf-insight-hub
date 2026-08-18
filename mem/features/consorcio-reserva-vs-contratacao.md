---
name: Consórcio Reserva vs Contratação
description: Cotas de consórcio têm tipo_registro reserva|contratacao; reserva gera parcelas 'previsto', não conta na etapa Cotas e é confirmada pela fila da etapa 5 com documento 'confirmacao_embracon'.
type: feature
---
Cotas de consórcio (`consortium_cards`) têm dois estados de cadastro:

- **tipo_registro = 'reserva'**: enviada à Embracon, ainda sem confirmação.
  - Obrigatório `data_reserva`; **`data_contratacao` fica nula**.
  - Parcelas geradas com status **'previsto'** (cronograma é só previsão).
  - Como a etapa 6 do funil (Cotas) filtra por `data_contratacao`, a reserva **só conta lá quando confirmada**.
- **tipo_registro = 'contratacao'**: a Embracon confirmou (comprovante em mãos).
  - `data_contratacao` obrigatória; parcelas pendente/pago normalmente.

Constraint `consortium_cards_datas_consistencia_check` garante a regra.
`OpenCotaModal` tem duas ações sem default: "Abrir como reserva" e "Abrir já contratada".
Etapa 5 ("Cadastradas") é fila de trabalho: seção "Aguardando confirmação da Embracon" **ignora o filtro de período** (semáforo de dias parados 7/15) + "Confirmadas no período". Mediana só conta cotas com reserva e confirmação em dias diferentes.
Confirmação (`useConfirmarContratacaoEmbracon`) exige documento `tipo = 'confirmacao_embracon'` (NÃO confundir com `consorcio_termos` tipo `comprovante_cadastro`, que a MCF envia ao cliente); a saída de exceção "Confirmar sem comprovante" exige motivo, gravado com carimbo em `observacoes`, e rende selo âmbar "sem comprovante".
KPIs em `useConsorcioPagamentos` separam totalRecebido, totalPendente, totalAtraso, **totalPrevisto** e cotasReservadas.
