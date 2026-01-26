

# Plano: Corrigir Clique nos Setores para Criar Pastas

## Problema Identificado

O clique no setor não está funcionando corretamente porque:

1. **O `Collapsible` está capturando cliques indevidamente** - O componente `Collapsible` com `onOpenChange` na linha 112 pode estar interceptando cliques antes que cheguem aos handlers corretos
2. **Os botões de ação não estão visíveis** - O botão "+" e menu de contexto ("⋮") têm `opacity-0` e só aparecem no hover, mas podem não estar aparecendo corretamente

## Solução Proposta

### Arquivo: `src/components/tasks/TaskSpacesSidebar.tsx`

**Mudança 1: Separar cliques do Collapsible**

Remover o `onOpenChange` do `Collapsible` e controlar a expansão apenas pelo `CollapsibleTrigger` (chevron):

```typescript
// ANTES (linha 112)
<Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(space.id)}>

// DEPOIS
<Collapsible open={isExpanded}>
```

Isso evita que cliques em qualquer lugar da linha acionem o toggle de expansão.

**Mudança 2: Manter botões de ação sempre visíveis (não apenas no hover)**

```typescript
// ANTES (linha 73 do SpaceContextMenu e linha 173 do Sidebar)
className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"

// DEPOIS - sempre visível
className="h-6 w-6"
```

**Mudança 3: Garantir que o clique na linha principal selecione o espaço**

Adicionar `onClick` no container principal da linha para garantir a seleção:

```typescript
// Linha 113-120: adicionar onClick no div principal
<div
  className={cn(
    "group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
    isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
  )}
  style={{ paddingLeft: `${8 + depth * 16}px` }}
  onClick={() => onSelectSpace(space.id)} // Adicionar aqui
>
```

E remover o onClick do div interno (linha 146) para evitar duplicação.

**Mudança 4: Prevenir propagação nos botões de ação**

Garantir que todos os botões de ação tenham `e.stopPropagation()` para não acionar a seleção do espaço:

```typescript
// Já existe no botão +, mas verificar no SpaceContextMenu
onClick={(e) => e.stopPropagation()}
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `TaskSpacesSidebar.tsx` | Remover `onOpenChange` do Collapsible |
| `TaskSpacesSidebar.tsx` | Mover onClick para o div principal da linha |
| `TaskSpacesSidebar.tsx` | Tornar botão "+" sempre visível |
| `SpaceContextMenu.tsx` | Tornar botão "⋮" sempre visível |

## Resultado Esperado

- Clicar em um setor irá selecioná-lo (destaque visual)
- O botão "+" estará sempre visível para criar pastas/listas
- O menu "⋮" estará sempre visível para renomear/excluir
- Apenas o chevron (>) controla a expansão/colapso

