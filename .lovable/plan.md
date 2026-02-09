
# Corrigir Tag "SETEMBRO 2025" Invisível no Filtro de Tags

## Problema

Os 165 leads com a tag "SETEMBRO 2025" existem corretamente no banco de dados, na pipeline "Efeito Alavanca + Clube" (origin_id: 7d7b1cb5-2a44-4552-9eff-c3b798646b78), com todos os dados corretos. O problema é exclusivamente no **filtro de tags** do Kanban.

A pipeline "Efeito Alavanca + Clube" possui **656 tags únicas**, mas o hook `useUniqueDealTags` tem um limite fixo de **500 tags**. Como a ordenação é alfabética, "SETEMBRO 2025" fica na posição **599** e é cortada antes de ser carregada no filtro.

Por isso, ao buscar "setembro" no popover de tags, aparece "Nenhuma tag encontrada".

## Solucao

Aumentar o limite de tags no hook `useUniqueDealTags` de 500 para 1000, garantindo que tags como "SETEMBRO 2025" (e outras nas posicoes 501-656) aparecam no filtro.

## Secao Tecnica

### Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useUniqueDealTags.ts` | Alterar limite de 500 para 1000 na linha `return uniqueTags.slice(0, 500)` |

### Mudanca Especifica

Na linha 53 do arquivo `src/hooks/useUniqueDealTags.ts`:

```text
ANTES: return uniqueTags.slice(0, 500);
DEPOIS: return uniqueTags.slice(0, 1000);
```

### Por que 1000?

- Atualmente existem 656 tags unicas nessa pipeline
- 1000 dá margem para crescimento sem impactar performance
- O componente `TagFilterPopover` já possui busca textual, entao a UX nao é afetada por uma lista maior

### Resultado Esperado

Apos a correcao, ao abrir o filtro de Tags no Kanban da pipeline "Efeito Alavanca + Clube" e buscar "setembro", a tag "SETEMBRO 2025" aparecerá normalmente, permitindo filtrar os 165 leads.
