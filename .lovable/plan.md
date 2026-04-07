

# Adicionar Vinculação Manual no Painel de Revisão de Boletos

## Problema
Atualmente o painel de revisão mostra boletos "Sem Vínculo" e "Parcial", mas não permite vincular ou corrigir manualmente a carta. O hook `useRelinkBoleto` já existe mas não está conectado à UI.

## Mudanças

### `src/components/consorcio/pagamentos/BoletoReviewDialog.tsx`

1. **Adicionar modo de vinculação manual em cada card**:
   - Botão "Vincular" (para sem vínculo) e "Corrigir" (para parcial com match errado)
   - Ao clicar, abre um campo de busca inline dentro do card
   - Busca cartas em `consortium_cards` por nome, grupo ou cota (query com `ilike`)
   - Exibe lista de resultados com nome, grupo, cota para selecionar
   - Ao selecionar, chama `useRelinkBoleto` com o `cardId` escolhido

2. **Fluxo UX**:
   - Card sem vínculo: mostra botão "Vincular Carta" ao lado do "Ver PDF"
   - Card parcial: mostra botão "Corrigir" ao lado do "Confirmar"
   - Ambos abrem o mesmo componente de busca inline
   - Após vincular, o card some da lista (match_confidence vira 'exact')

### `src/hooks/useConsorcioBoletos.ts`
- Já possui `useRelinkBoleto` — nenhuma mudança necessária

### Novo: busca de cartas
- Adicionar hook `useSearchCards` ou query inline no componente para buscar `consortium_cards` com filtro por nome/grupo/cota via `ilike`

### Arquivos
- `src/components/consorcio/pagamentos/BoletoReviewDialog.tsx` — adicionar UI de vinculação manual
- `src/hooks/useConsorcioBoletos.ts` — adicionar hook de busca de cartas (se necessário)

