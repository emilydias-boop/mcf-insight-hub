---
name: Consórcio payment date confirmation
description: Toda marcação de parcela como 'pago' no consórcio exige confirmação explícita da data real do pagamento (data_pagamento), via ConfirmPaymentDateDialog. Nunca usar new Date() automaticamente.
type: feature
---

## Regra
Em qualquer ponto do módulo Consórcio onde uma `consortium_installments.status` for alterada para `'pago'`, o usuário **deve** ser obrigado a informar a `data_pagamento` real. Nunca preencher com `new Date()` / `today()` automaticamente — isso infla a Previsão semanal/mensal de comissões e foi a causa raiz do descompasso entre R$ 270k previsto e ~R$ 100k recebido no Asaas (semana 22 / 04-jun-2026).

## Implementação
- Componente reutilizável: `src/components/consorcio/ConfirmPaymentDateDialog.tsx` — pede data, default = `data_vencimento` (ou hoje se não houver), bloqueia datas futuras, alerta quando |delta vs vencimento| > 60 dias.
- Pontos atualmente protegidos:
  - `src/components/consorcio/ConsorcioCardDrawer.tsx` (botão "Marcar como pago" no detalhe da cota).
  - `src/components/consorcio/pagamentos/PagamentosTable.tsx` (botão verde de check na grade /consorcio/pagamentos).
  - `src/components/consorcio/EditInstallmentDialog.tsx` — `Salvar` fica desabilitado se `status='pago'` e `data_pagamento` vazia.

## Ao criar novos fluxos
Se adicionar novo botão/ação/import que marque parcela como paga, **sempre** roteie por `ConfirmPaymentDateDialog` antes de chamar `usePayInstallment` ou fazer update direto. Aplica-se também a importações em lote: a importação precisa exigir a coluna de data de pagamento real por linha (não fallback para hoje).
