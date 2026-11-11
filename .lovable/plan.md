# Meta de cobrança: contar só o que é cobrança de verdade

## O que foi verificado (novembro/2026, total R$ 284.693,10)
- **R$ 264.949,44 (93%) estão em "Sem cobrador"** e quase tudo é venda nova, não cobrança:
  - R$ 254.125,79 vêm de **pagamentos integrais** (título com uma só parcela, paga no ato): 30 vendas em Pix, cartão, Apple Pay ou forma não informada.
  - R$ 10.823,65 são a **1ª parcela** (entrada) de vendas parceladas, pagas em cartão, Pix, Apple Pay ou boleto.
  - Nenhum desses pagamentos é parcela atrasada ou seguinte; nenhum veio da agenda de cobranças.
- **Só R$ 19.743,66 têm cobrador** e se parecem com cobrança: parcelas 2+ (R$ 4.951,66), entradas (R$ 12.797) e um pagamento integral (R$ 800). Apenas R$ 1.195 eram de parcela vencida antes do mês.
- Conclusão: hoje o painel soma **todo recebimento do mês**, não "previsto x recebido" das cobranças regulares e da agenda.

## Ajuste proposto
Contar como "convertido em cobrança" somente o pagamento que:
1. é de parcela **2 em diante** (sem entrada e sem pagamento integral no ato);
2. pertence a um título em **cobrança regular** (aberto, sem jurídico e sem cartão já recebido no ato — a mesma regra das abas Agenda e Pendências);
3. não é reembolso ou estorno.

O painel também passa a mostrar **Previsto do mês** (parcelas da cobrança com vencimento no mês, mais as atrasadas em aberto) ao lado de **Recebido**, e o card "Sem cobrador" fica só com cobranças sem responsável definido.

## Detalhes técnicos
- `batimentoPorCobrador` em `src/lib/arCobrancaCalc.ts`: filtro `numero > 1` + `!tituloForaCobranca(titulo)` (avaliar o título fora do status atual, pois título quitado no mês sai de "aberto": usar só judicial/cartão para títulos quitados); adicionar `previsto` por cobrador.
- Atualizar `src/lib/arMetaCobranca.test.ts` com casos: integral excluído, 1ª parcela excluída, parcela 2 contada, judicial excluído.
- `MetaCobrancaPainel.tsx`: exibir Previsto x Recebido. Sem mudança no banco.
