---
name: Etapa 5 — marcador da parcela inicial (controle interno)
description: Onde vive o marcador de pagamento da parcela inicial da etapa 5 do funil Consórcio e por que ele é isolado de finanças.
type: feature
---

Etapa 5 = **Cotas Cadastradas**: cadastros pendentes com card criado e grupo/cota preenchidos.
Duas listas (`FilaDuasListas`): aguardando pagamento da parcela inicial × pagas.

Marcador (controle interno, um botão por cota — escolha do dono):
- `consorcio_pending_registrations.parcela_inicial_paga_em` (date) e
  `parcela_inicial_paga_por` (uuid). Hook `useCotasCadastradas` / `useMarcarParcelaInicial`.
- **Nunca** usar `consortium_installments` nº 1 pago (alimenta comissão/payout/KPI "Cartas Subidas")
  nem gravar em campos de `consortium_cards` observados pelo trigger de webhook de saída.
- Proibido gerar título, boleto, cobrança, previsão de caixa ou saída para o FinanceHub.

"Não paga — prazo expirado" é **estado derivado** (1 dia após o cadastro sem pagamento), sem job.
O **Comprovante de Adesão** (`consorcio_termos` tipo `comprovante_cadastro`) é emitido nesta etapa e é a
verdade oficial sobre quais parcelas a MCF paga; a etapa 2 é só intenção e serve de pré-preenchimento.
