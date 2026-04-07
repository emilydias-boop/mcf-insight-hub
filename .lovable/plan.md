

# Mover botão "Revisar Boletos" para o header da página

## Problema
O botão "Revisar Boletos" fica na linha de filtros dentro do `ConsorcioPagamentosTab`, difícil de ver. O usuário quer ele visível no topo, ao lado de "Subir Boletos".

## Mudanças

### `src/pages/bu-consorcio/Pagamentos.tsx`
- Importar `useBoletosReview` e `BoletoReviewDialog`
- Adicionar estado `reviewOpen` e botão "Revisar Boletos" com badge de contagem ao lado do `BoletoUploadDialog`, usando variante `destructive` (amber) para destaque
- Renderizar `BoletoReviewDialog` neste nível

### `src/components/consorcio/pagamentos/ConsorcioPagamentosTab.tsx`
- Remover o botão "Revisar Boletos", o estado `reviewOpen`, o import de `BoletoReviewDialog` e `useBoletosReview` (já que sobe para a página pai)

### Resultado
- Botão sempre visível no header, ao lado de "Subir Boletos" e seletor de mês
- Badge com contagem dinâmica dos boletos pendentes de revisão

