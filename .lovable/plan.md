
# Plano: Usar created_at para Tempo na Pipeline

## Alteração

Trocar `updated_at` por `created_at` na linha 262 do `DealKanbanCard.tsx`:

**Antes:**
```typescript
const timeAgoShort = deal.updated_at ? getShortTimeAgo(deal.updated_at) : null;
```

**Depois:**
```typescript
const timeAgoShort = deal.created_at ? getShortTimeAgo(deal.created_at) : null;
```

## Resultado

O tempo mostrado no card indicará há quanto tempo o lead entrou na pipeline (data de criação), não quando foi atualizado por último.

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/DealKanbanCard.tsx` | Linha 262: trocar `updated_at` por `created_at` |
