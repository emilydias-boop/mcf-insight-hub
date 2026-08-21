---
name: Etapa 5 (parcela inicial paga) é controle interno — não toca o FinanceHub
description: O marcador de pagamento da parcela inicial do consórcio é operacional interno; proibido gerar lançamento financeiro, cobrança ou saída para o FinanceHub/MCF Pay/Asaas.
type: constraint
---

O registro de pagamento da parcela inicial na etapa 5 do funil de Venda Consórcio é
**controle operacional interno da equipe de cobranças/cadastro**.

Proibido:
- gerar lançamento financeiro, título a receber, boleto, cobrança ou previsão de caixa;
- disparar webhook de saída, evento ou payload para o **FinanceHub** (`adm.mcfcapital.com.br`,
  projeto Finance Friend), MCF Pay ou Asaas;
- alimentar KPI/BI financeiro, comissão ou payout a partir desse marcador.

**Why:** decisão do dono — "não queria que o pagamento daqui influenciasse no FinanceHub,
é mais pra controle interno da equipe de cobranças mesmo".

**How to apply:** o marcador precisa nascer isolado. Cuidado com dois caminhos que já
reagem sozinhos hoje:
1. `consortium_cards` tem trigger `trg_enqueue_outbound_consorcio_webhook` que enfileira
   evento externo quando mudam `status`, `valor_credito`, `valor_comissao`,
   `parcelas_pagas_empresa`, `grupo`, `cota`, contemplação ou `tipo_produto`.
   Não gravar o marcador nesses campos.
2. `consortium_installments` com `numero_parcela = 1` e `status = 'pago'` já alimenta o KPI
   "Cartas Subidas", a previsão de comissões e `get_consorcio_commission_summary`.
   Não reutilizar esse status como marcador operacional.

Rodada F (marcação parcela a parcela oficial) só depois de alinhamento explícito com o dono.
