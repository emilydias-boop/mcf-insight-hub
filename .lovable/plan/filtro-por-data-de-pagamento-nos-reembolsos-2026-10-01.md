# Filtro por data de pagamento nos Reembolsos

## O que muda

Na aba "Reembolsos" (listagem) do painel de Reembolsos (Financeiro > À Receber), além dos filtros existentes de Data de solicitação, Data prevista e Prazo, será adicionado um bloco **"Pago em"** com intervalo de datas (De / Até), referente à data de pagamento efetivo do reembolso (`data_pagamento`).

Exemplo de uso: para ver só os reembolsos pagos em setembro, preencher "Pago em" de 01/09/2026 até 30/09/2026 (combinando com o filtro de status "Pago", se desejado).

Comportamento:
- Linhas com status **pago** são filtradas pela data de pagamento informada.
- Reembolsos ainda não pagos (sem `data_pagamento`) ficam de fora quando o filtro estiver ativo.
- O botão "limpar datas" e a detecção de filtro ativo passam a considerar o novo campo.
- O filtro combina com os demais existentes (busca por texto, status, prazo, outras datas).
- Cards de totais e a exportação XLSX continuam refletindo a lista filtrada (nada a mudar neles).

## Detalhes técnicos

Arquivo único: `src/components/financeiro/aReceber/ReembolsosPanel.tsx`

1. Novos states `pagoDe` / `pagoAte` (strings `yyyy-MM-dd`), ao lado de `pedidoDe/pedidoAte`.
2. `limparFiltrosData`: também zerar `pagoDe`/`pagoAte`.
3. `temFiltroData`: incluir `pagoDe || pagoAte`.
4. `reembolsosFiltrados` (useMemo): nova condição `if (!inRange(r.data_pagamento, pagoDe, pagoAte)) return false;` — a helper `inRange` já existe no arquivo e trata `null`/undefined como fora do intervalo. Adicionar `pagoDe`/`pagoAte` nas dependências do memo.
5. UI: novo bloco igual aos existentes (Label "Pago em" + dois `Input type="date"` `h-8 text-xs`), inserido após o bloco "Data prevista" no grid de filtros.
6. Estado vazio: nada a alterar — a mensagem "Nenhum reembolso encontrado para esse filtro." já usa `temFiltroData`, que passará a cobrir o novo filtro.

Sem migration, sem alteração de hooks: `useArReembolsos` já retorna `data_pagamento` (coluna de `ar_reembolsos`, presente no tipo `ArReembolso`). Filtro 100% client-side, no mesmo padrão dos filtros de data já existentes.

Ao final: `npx tsgo --noEmit` e `npm run build`.
