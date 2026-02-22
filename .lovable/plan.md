
# Fix: Erro ao editar carta de consorcio (mesmo problema da criacao)

## Problema

O hook `useUpdateConsorcioCard` em `src/hooks/useConsorcio.ts` envia os dados diretamente ao Supabase sem sanitizar campos vazios (`""`). Isso causa o mesmo erro da criacao: campos UUID como `vendedor_id` recebem string vazia em vez de `null`, gerando erro de tipo invalido no banco.

## Solucao

Aplicar a mesma sanitizacao que foi feita no `useCreateConsorcioCard`:

1. Remover campos com valor `""` ou `undefined` antes do update
2. Melhorar mensagem de erro para exibir o detalhe do banco

## Alteracoes

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/hooks/useConsorcio.ts` | 339-343 | Adicionar sanitizacao de `cardData` antes do `.update()` |
| `src/hooks/useConsorcio.ts` | 403-405 | Melhorar mensagem de erro no `onError` |

### Detalhe tecnico

**Linha 339-343** - Adicionar sanitizacao antes do update:

```typescript
// Sanitizar campos vazios antes de enviar ao banco
const cleanedData = Object.fromEntries(
  Object.entries(cardData).filter(([_, v]) => v !== '' && v !== undefined)
);

const { error: cardError } = await supabase
  .from('consortium_cards')
  .update(cleanedData)
  .eq('id', id);
```

**Linha 403-405** - Melhorar erro:

```typescript
onError: (error: any) => {
  console.error('Erro ao atualizar carta:', error);
  toast.error(`Erro ao atualizar carta: ${error?.message || 'Erro desconhecido'}`);
},
```

## Resultado

- Editar carta com campos opcionais vazios nao causa erro de UUID invalido
- Mensagem de erro mais detalhada para diagnostico futuro
