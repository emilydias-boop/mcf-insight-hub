

# Painel de Revisão de Boletos Parciais/Pendentes

## Problema
Existem 31 boletos com match "parcial" e 3 com "pending_review" que foram vinculados automaticamente pela IA mas com confiança baixa (ex: nome bate mas grupo/cota extraído difere do card vinculado). Não existe interface para revisar, confirmar ou corrigir essas vinculações.

## Solução
Criar um painel de revisão acessível via botão ao lado do "Subir Boletos", mostrando todos os boletos parciais/pendentes com opção de confirmar ou re-vincular.

## Mudanças

### 1. Novo hook: `useBoletosReview` em `src/hooks/useConsorcioBoletos.ts`
- Query que busca boletos com `match_confidence IN ('partial', 'pending_review')`
- Join com `consortium_cards` para mostrar o card vinculado atual
- Mutation `useConfirmBoletoMatch` para atualizar `match_confidence` para `'exact'`
- Mutation `useRelinkBoleto` para mudar o `card_id` e `installment_id` de um boleto

### 2. Novo componente: `BoletoReviewDialog.tsx`
- Dialog com lista dos boletos pendentes de revisão (34 no total)
- Cada item mostra:
  - Nome extraído do PDF vs nome do card vinculado
  - Grupo/Cota extraídos vs Grupo/Cota do card
  - Valor e vencimento extraídos
  - Botão "Confirmar" (marca como `exact`)
  - Botão "Ver PDF" (abre signed URL)
  - Select para re-vincular a outro card (busca por nome/grupo/cota)
- Badge com contagem de pendentes no botão de abrir

### 3. Atualizar `ConsorcioPagamentosTab.tsx`
- Adicionar botão "Revisar Boletos (34)" ao lado do "Subir Boletos" e "Exportar"
- Badge com contagem dinâmica de boletos pendentes

### Arquivos
- `src/hooks/useConsorcioBoletos.ts` — adicionar hooks de review
- `src/components/consorcio/pagamentos/BoletoReviewDialog.tsx` — novo
- `src/components/consorcio/pagamentos/ConsorcioPagamentosTab.tsx` — botão de acesso

