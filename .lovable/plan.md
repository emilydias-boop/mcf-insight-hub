

# Fix Review Dialog: Mostrar Card Vinculado + Corrigir Scroll

## Problemas

1. **Sem informação do match**: Muitos boletos mostram "Card Nome: —" e "Card Grupo/Cota: —/—" porque o `card_id` é null (a IA não encontrou match). Confirmar sem saber a qual carta vinculou não faz sentido.

2. **Scroll não funciona**: O `ScrollArea` não tem altura fixa definida — `flex-1 min-h-0` dentro do DialogContent não está gerando altura calculável, impedindo o scroll.

## Mudanças

### `src/components/consorcio/pagamentos/BoletoReviewDialog.tsx`

1. **Corrigir scroll**: Adicionar `h-[60vh]` no ScrollArea para garantir altura fixa e scroll funcional.

2. **Separar boletos com e sem match**: Mostrar claramente quando um boleto **não tem card vinculado** (card_id null) vs quando tem card mas dados divergem:
   - Sem match: Badge "Sem Vínculo" (vermelho) + mensagem clara "Nenhuma carta vinculada — necessário vincular manualmente"
   - Com match parcial: Mostrar lado a lado PDF vs Card como hoje, mas com destaque visual melhor

3. **Mostrar nome do card vinculado de forma proeminente**: Quando há card vinculado, exibir o nome do card em destaque no topo do card, para o usuário saber exatamente qual carta a IA escolheu antes de confirmar.

4. **Desabilitar "Confirmar" quando não há card**: Se `card_id` é null, não faz sentido confirmar — esconder botão confirmar e mostrar apenas "Ver PDF" nesses casos.

### Arquivos
- `src/components/consorcio/pagamentos/BoletoReviewDialog.tsx`

