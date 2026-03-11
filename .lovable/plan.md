

## Problema: Tag "LEAD-SCORE" não aparece no card do Kanban

### Causa raiz

Linha 341 do `DealKanbanCard.tsx`:
```typescript
{deal.tags?.slice(0, 1).map((tag: any, idx: number) => (
```

Só mostra **1 tag** (`slice(0, 1)`). Como "base clint" é sempre a primeira no array, "LEAD-SCORE" fica oculta.

### Correção

**Arquivo: `src/components/crm/DealKanbanCard.tsx`**

1. Filtrar tags "base clint" (tag de sistema, sem valor visual) antes de exibir
2. Mostrar até **2 tags** visíveis no card (excluindo "base clint")

```typescript
// Antes:
{deal.tags?.slice(0, 1).map(...)}

// Depois:
{deal.tags
  ?.filter((tag: any) => {
    const name = typeof tag === 'string' ? tag : tag.name;
    return name?.toLowerCase() !== 'base clint';
  })
  .slice(0, 2)
  .map((tag: any, idx: number) => (
    <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0"
      style={{ backgroundColor: tag.color || undefined }}>
      {typeof tag === 'string' ? tag : tag.name}
    </Badge>
  ))}
```

Resultado: "LEAD-SCORE" (e outras tags relevantes) aparecerão diretamente no card do Kanban, enquanto "base clint" fica oculta por ser tag de sistema.

