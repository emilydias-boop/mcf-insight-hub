
# Plano: Corrigir Reset de Campos no Modal de Edição de Carta de Consórcio

## Problema Identificado

Quando o modal de edição é aberto, alguns campos estão sendo resetados para valores vazios em vez de carregar os dados salvos no banco. Isso ocorre porque o `form.reset()` no `useEffect` (linhas 476-536) está **faltando 4 campos** que existem no formulário:

| Campo Faltando | O que acontece |
|----------------|----------------|
| `valor_comissao` | Zera o valor da comissão |
| `e_transferencia` | Reseta para `false` |
| `transferido_de` | Apaga informação de quem transferiu |
| `observacoes` | Apaga todas as observações |

## Causa Raiz

O `useEffect` que faz o `form.reset()` quando o modal abre (linha 471-595) não está incluindo esses 4 campos do "Controle Adicional", apesar de:
1. O formulário ter esses campos definidos no schema (linhas 126-129)
2. O `defaultValues` original incluir esses campos (linhas 241-245)
3. O tipo `ConsorcioCard` ter esses campos (linhas 88-93)
4. O `onSubmit` enviar esses campos corretamente (linhas 757-761)

## Solução

Adicionar os 4 campos faltantes no `form.reset()` do modo de edição.

### Arquivo a Modificar

**`src/components/consorcio/ConsorcioCardForm.tsx`**

Na função `useEffect` (linha 471-595), dentro do bloco `if (card)` (linha 476-536), adicionar os campos faltantes após a linha 531 (partners):

```typescript
// Adicionar após linha 531:
// Controle adicional
valor_comissao: card.valor_comissao ? Number(card.valor_comissao) : undefined,
e_transferencia: card.e_transferencia || false,
transferido_de: card.transferido_de || undefined,
observacoes: card.observacoes || undefined,
```

## Resultado Esperado

Após a correção:
- Ao abrir o modal de edição, todos os campos serão carregados corretamente com os valores do banco
- Data de contratação, observações, valor de comissão e demais campos manterão seus valores originais
- O comportamento será consistente entre `defaultValues` inicial e o `reset()` no useEffect
