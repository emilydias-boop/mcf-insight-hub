
# Plano: Mostrar Nome Completo do Consorciado na Tabela

## Problema Identificado

A coluna "Nome" na tabela de consórcio está usando a função `getFirstLastName()` que **trunca o nome** para mostrar apenas o primeiro e o último nome:

```typescript
// Linha 90-95 - Função atual
function getFirstLastName(fullName?: string): string {
  if (!fullName) return '-';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}
```

**Resultado atual:** "FELIPE BELLARD GUIMARAES" → "FELIPE GUIMARAES"

## Solução Proposta

Alterar a exibição na tabela para mostrar o **nome completo** do consorciado, mantendo a coluna "Responsável" com o nome do vendedor já existente.

## Alterações Técnicas

### Arquivo: `src/pages/bu-consorcio/Index.tsx`

**Linha 555 - Exibição do nome na tabela:**

| Antes | Depois |
|-------|--------|
| `getFirstLastName(displayName)` | `displayName \|\| '-'` |

**Código alterado:**
```tsx
// Linha 555
<TableCell className="font-medium">{displayName || '-'}</TableCell>
```

**Linha 248 no CSV export (opcional):**
Para manter consistência, também alterar o export:

| Antes | Depois |
|-------|--------|
| `getFirstLastName(displayName)` | `displayName \|\| '-'` |

## Resultado Esperado

| Campo | Antes | Depois |
|-------|-------|--------|
| Nome | FELIPE GUIMARAES | FELIPE BELLARD GUIMARAES |
| Responsável | João Pedro Martins Vieira | João Pedro Martins Vieira (sem alteração) |

## Arquivos a Modificar

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `src/pages/bu-consorcio/Index.tsx` | 555 | Usar `displayName` direto |
| `src/pages/bu-consorcio/Index.tsx` | 248 | Atualizar export CSV |

## Impacto

- A coluna "Nome" mostrará o nome completo do consorciado (PF ou razão social)
- A coluna pode ficar mais larga para acomodar nomes longos
- A função `getFirstLastName` pode ser removida se não for usada em outro lugar
