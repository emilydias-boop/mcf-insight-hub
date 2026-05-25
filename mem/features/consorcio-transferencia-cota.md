---
name: Consórcio - Transferência de Cota Contemplada
description: Fluxo completo de pós-contemplação (manter/à venda/transferir) com processo de transferência em fases, comprador, análise de crédito, dados oficiais e financeiro como evento separado.
type: feature
---
Após contemplação a cota tem `pos_contemplacao_decisao` em `consortium_cards`: `manter | a_venda | em_transferencia | transferida`. UI: `PosContemplacaoPanel` dentro de `ConsorcioCardDrawer` aparece só quando `motivo_contemplacao` está preenchido.

Processo vive em `consortium_transfers` (1 ativa por carta — unique index parcial), com fases ordenadas: precificacao → comprador → analise_credito → documentacao → transferencia_oficial → financeiro → concluida (ou cancelada).

Tabelas:
- `consortium_transfer_buyers` (1:1): dados do novo titular (PF/PJ). Aplicados via trigger `tg_apply_transfer_on_complete` (BEFORE UPDATE) quando fase muda para 'concluida', sobrescrevendo titular na carta original e marcando carta como `transferida`. Cronograma de parcelas (`consortium_installments`) NÃO é alterado.
- `consortium_transfer_financials` (1:N): evento financeiro separado (entrada_comprador, repasse_consorciado, comissao_empresa, taxa_administradora) com status previsto/recebido/pago/cancelado. Não toca em comissões das parcelas existentes — vendedor original mantém a atribuição.
- `consortium_transfer_documents` (1:N).

Comissão da empresa: sempre digitada manualmente na precificação (sem default automático).

Cotas marcadas como `a_venda` listadas em `/consorcio/cotas-a-venda` (hook `useCotasAVenda`).

Logs automáticos via `tg_log_consortium_transfer_activity` em `consortium_card_activity_log` com `event_category='transferencia'` para: iniciado, mudança de fase, precificação, análise de crédito, dados oficiais, concluído, cancelado.