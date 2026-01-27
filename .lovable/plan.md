

# Plano: Mostrar Nome e Sobrenome do Responsável

## Problema Identificado

A coluna "Responsável" exibe o nome completo do vendedor (ex: "João Pedro Martins Vieira"), mas você quer apenas os **dois primeiros nomes** (ex: "João Pedro").

## Solução Proposta

1. **Criar uma nova função** `getFirstTwoNames` que extrai os dois primeiros nomes
2. **Aplicar na tabela** e no **export CSV**

## Alterações Técnicas

### Arquivo: `src/pages/bu-consorcio/Index.tsx`

**Nova função (após linha 95):**

```typescript
// Extract first two names from full name
function getFirstTwoNames(fullName?: string): string {
  if (!fullName) return '-';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName.trim();
  return `${parts[0]} ${parts[1]}`;
}
```

**Linha 259 - Export CSV:**

| Antes | Depois |
|-------|--------|
| `card.vendedor_name \|\| ''` | `getFirstTwoNames(card.vendedor_name)` |

**Linha 601 - Tabela:**

| Antes | Depois |
|-------|--------|
| `{card.vendedor_name \|\| '-'}` | `{getFirstTwoNames(card.vendedor_name)}` |

## Resultado Esperado

| Campo | Antes | Depois |
|-------|-------|--------|
| Nome (consorciado) | FELIPE BELLARD GUIMARAES | FELIPE BELLARD GUIMARAES (completo) |
| Responsável | João Pedro Martins Vieira | João Pedro |

## Arquivos a Modificar

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| `src/pages/bu-consorcio/Index.tsx` | ~96 | Adicionar função `getFirstTwoNames` |
| `src/pages/bu-consorcio/Index.tsx` | 259 | Usar função no CSV export |
| `src/pages/bu-consorcio/Index.tsx` | 601 | Usar função na tabela |

## Impacto

- A coluna "Responsável" mostrará apenas nome e sobrenome
- Mantém o nome completo do consorciado (alteração anterior)
- Export CSV também refletirá essa mudança

