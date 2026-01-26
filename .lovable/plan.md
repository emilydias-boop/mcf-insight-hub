

# Plano: Corrigir Visibilidade do Menu Suspenso

## Problema Identificado

O menu dropdown do contexto está sendo cortado porque:

1. **Container pai com `overflow-hidden`** - O container da linha do item (linha 148) tem a classe `overflow-hidden` que está cortando o menu dropdown quando ele abre
2. **Posicionamento do dropdown** - O `DropdownMenuContent` precisa de melhor configuração de posicionamento para evitar ficar atrás de outros elementos

## Solução Proposta

### Arquivo: `src/components/tasks/SpaceContextMenu.tsx`

Adicionar configurações ao `DropdownMenuContent` para garantir que o menu apareça corretamente:

```typescript
<DropdownMenuContent 
  align="start"           // Mudar de "end" para "start" 
  side="right"           // Abrir para a direita ao invés de para baixo
  sideOffset={5}         // Adicionar espaçamento
  className="w-48 bg-popover border shadow-md z-[100]"  // z-index mais alto
  onClick={(e) => e.stopPropagation()}
>
```

### Arquivo: `src/components/tasks/TaskSpacesSidebar.tsx`

Remover o `overflow-hidden` do container que contém os botões de ação, pois ele está cortando o dropdown:

```typescript
// ANTES (linha 148)
<div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">

// DEPOIS - mover overflow apenas para o texto
<div className="flex items-center gap-2 flex-1 min-w-0">
```

E garantir que apenas o texto seja truncado:

```typescript
// Linha 158
<span className="truncate text-sm font-medium flex-1 min-w-0">{space.name}</span>
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `SpaceContextMenu.tsx` | Adicionar `side="right"`, `sideOffset={5}`, aumentar z-index para `z-[100]` |
| `TaskSpacesSidebar.tsx` | Remover `overflow-hidden` do container principal e mover para o span do texto |

## Resultado Esperado

- O menu dropdown abrirá para o lado direito do botão
- O conteúdo do menu será totalmente visível
- O nome do espaço continuará truncando corretamente quando muito longo

