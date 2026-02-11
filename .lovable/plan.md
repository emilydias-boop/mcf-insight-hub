
# Corrigir erro ao salvar carta de consorcio

## Problema
A coluna `inicio_segunda_parcela` nao existe na tabela `consortium_cards` no banco de dados, mas o codigo envia esse campo na insercao. Isso causa o erro: `Could not find the 'inicio_segunda_parcela' column`.

O campo e usado apenas para calcular as datas de vencimento das parcelas (logica no JS), mas nao deve ser enviado ao banco.

## Solucao
Remover `inicio_segunda_parcela` do objeto enviado ao banco, junto com `partners` (que ja e removido).

## Secao tecnica

### Arquivo: `src/hooks/useConsorcio.ts`

**Linha 191** - Alterar a destructuring para tambem excluir `inicio_segunda_parcela`:

```text
Antes:  const { partners, ...cardData } = input;
Depois: const { partners, inicio_segunda_parcela, ...cardData } = input;
```

A variavel `inicio_segunda_parcela` ja e acessada via `input.inicio_segunda_parcela` na linha 222, entao nao precisa de nenhuma outra mudanca.
