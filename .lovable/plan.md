
# Fix: Erro ao criar carta de consorcio

## Problema

O formulario de criacao de carta de consorcio envia campos opcionais com valores vazios (`""`) em vez de `undefined` ou `null`. O campo mais critico e `vendedor_id`, que e do tipo UUID no banco de dados. Quando o usuario nao seleciona um vendedor, o valor `""` (string vazia) e enviado para uma coluna UUID, causando erro de tipo invalido no Supabase.

Outros campos opcionais como `origem_detalhe`, `vendedor_name`, `transferido_de`, `observacoes`, `pix`, etc. tambem podem ser enviados como strings vazias, o que nao causa erro de tipo mas polui os dados.

## Solucao

Sanitizar os dados no hook `useCreateConsorcioCard` (arquivo `src/hooks/useConsorcio.ts`) antes de enviar ao Supabase. Converter strings vazias em `undefined` para campos opcionais, especialmente para `vendedor_id` que e UUID.

Alternativamente (e mais seguro), sanitizar na construcao do `input` no formulario (`src/components/consorcio/ConsorcioCardForm.tsx`), tratando `vendedor_id` da mesma forma que outros campos opcionais.

## Alteracoes

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/components/consorcio/ConsorcioCardForm.tsx` | 784 | `vendedor_id: data.vendedor_id \|\| undefined` (mesmo padrao usado para tipo_servidor, renda, etc.) |
| `src/hooks/useConsorcio.ts` | 189-196 | Adicionar sanitizacao de campos antes do insert: remover chaves com valor `""` ou `undefined` do `cardData`, e converter `vendedor_id` vazio para `null` |

### Detalhe tecnico

No arquivo `src/components/consorcio/ConsorcioCardForm.tsx`, linha 784:

```
// Antes:
vendedor_id: data.vendedor_id,

// Depois:
vendedor_id: data.vendedor_id || undefined,
```

No arquivo `src/hooks/useConsorcio.ts`, adicionar sanitizacao geral no `mutationFn` antes do insert para limpar campos vazios:

```typescript
// Limpar campos string vazios e converter para null/undefined
const cleanedData = Object.fromEntries(
  Object.entries(cardData).filter(([_, v]) => v !== '' && v !== undefined)
);
```

Tambem melhorar a mensagem de erro no `onError` para mostrar o detalhe do erro ao usuario (facilitar debug futuro):

```typescript
onError: (error: any) => {
  console.error('Erro ao criar carta:', error);
  toast.error(`Erro ao criar carta: ${error?.message || 'Erro desconhecido'}`);
},
```

## Resultado

- Campos opcionais vazios nao sao enviados ao banco
- `vendedor_id` vazio nao causa erro de UUID invalido
- Mensagem de erro mais detalhada para facilitar diagnostico futuro
