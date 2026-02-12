
# Corrigir Erros ao Atualizar Cotas e Editar Parcelas

## Problema

Dois bugs causados por campos extras (que nao existem no banco de dados) sendo enviados nas chamadas de update do Supabase:

1. **"Erro ao atualizar carta"**: O campo `inicio_segunda_parcela` e incluido no objeto de update, mas essa coluna NAO existe na tabela `consortium_cards`. A funcao de criacao remove esse campo antes de inserir (linha 191), mas a funcao de update nao faz o mesmo.

2. **"Erro ao atualizar parcela"**: O campo `recalcularDemais` e passado diretamente para o `updateInstallment.mutateAsync(data)`, e dentro do hook, o spread `{ id, ...updateData }` inclui `recalcularDemais` no objeto enviado ao Supabase, que rejeita por nao existir na tabela `consortium_installments`.

## Solucao

### 1. Corrigir `useUpdateConsorcioCard` (src/hooks/useConsorcio.ts)

Destruturar `inicio_segunda_parcela` junto com `partners` antes de enviar ao Supabase:

```text
// Antes (linha 304):
async ({ id, partners, ...cardData })

// Depois:
async ({ id, partners, inicio_segunda_parcela, ...cardData })
```

### 2. Corrigir `handleSaveInstallment` (src/components/consorcio/ConsorcioCardDrawer.tsx)

Remover `recalcularDemais` do objeto antes de passar para `updateInstallment.mutateAsync`:

```text
// Antes (linha 183):
await updateInstallment.mutateAsync(data);

// Depois:
const { recalcularDemais, ...installmentData } = data;
await updateInstallment.mutateAsync(installmentData);
```

## Arquivos a modificar

1. **`src/hooks/useConsorcio.ts`** - Linha 304: adicionar `inicio_segunda_parcela` na desestruturacao
2. **`src/components/consorcio/ConsorcioCardDrawer.tsx`** - Linha 181-183: separar `recalcularDemais` antes do mutateAsync
