## Diagnóstico

Não é problema de webhook do Make. As duas vendas chegaram normalmente no sistema (Hubla → tabela `hubla_transactions`, status `completed`, com email/telefone):

- `eng.alexbvaz@gmail.com` — A000 - Contrato — pago em 16/06/2026 19:04
- `andreaseabrademello@gmail.com` — A000 - Contrato + A018 Know How — pago em 16/06/2026 17:49

Ambas estão com `linked_attendee_id = null` (não vinculadas a nenhum atendimento). Os dois leads têm reunião com status `Realizada` no CRM, então deveriam aparecer na tela do closer para vincular.

**Causa real:** a lista "Contratos pendentes de vínculo" (`useUnlinkedContracts`) filtra por `product_category = 'contrato'`. O classificador do webhook (`mapProductCategory`) hoje mapeia `A000 - Contrato` como `incorporador` (e não mais como `contrato`, como acontecia em vendas antigas). Resultado: a venda existe no banco, mas é invisível na lista default do closer.

Comparação:
- Venda antiga (nov/2025) de Alex → `product_category = 'contrato'` → aparecia.
- Vendas novas (jun/2026) → `product_category = 'incorporador'` → não aparecem.

Outras telas já tratam os dois juntos. Ex.: `distribute-outside-leads` filtra `product_category IN ('contrato','incorporador')`.

## Plano

### 1. Corrigir o filtro da lista de vínculo
Arquivo: `src/hooks/useUnlinkedContracts.ts`

- Trocar `.eq('product_category', 'contrato')` por `.in('product_category', ['contrato', 'incorporador'])` no modo default (últimos 14 dias).
- O modo `searchAll` (busca manual por nome/email/telefone) já não filtra por categoria — fica como está.

### 2. Validar que as duas vendas passam a aparecer
Após o deploy, conferir via consulta que `eng.alexbvaz@gmail.com` e `andreaseabrademello@gmail.com` retornam pela query do hook e ficam visíveis para o closer vincular ao attendee `Realizada` correspondente.

### 3. Não mexer em vínculo automático nem em webhook
- Não há nada errado no recebimento Hubla → as transações estão lá com status `completed`.
- O vínculo automático com o attendee é opcional e não impede o closer de vincular manualmente; fora do escopo deste fix.
- Sem alterações em edge functions, schema ou regras de classificação.

## Detalhes técnicos

```ts
// Antes
.eq('product_category', 'contrato')

// Depois
.in('product_category', ['contrato', 'incorporador'])
```

Mudança isolada, 1 linha, sem impacto em métricas (que continuam usando seus próprios filtros).
