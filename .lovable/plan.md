

## Fix: Overflow de abas em todo o sistema (22 arquivos)

### Problema
O sistema usa `font-size: 50%` (base 8px). Quando `TabsList` usa `grid grid-cols-N` fixo, cada coluna fica muito estreita para o conteúdo (ícones + texto), causando overflow visual em múltiplos locais.

**22 arquivos afetados** usam o padrão `<TabsList className="grid w-full grid-cols-N">`.

### Solução

**1. Atualizar o componente base `TabsList`** (`src/components/ui/tabs.tsx`):
- Trocar `inline-flex` por `flex` com `overflow-x-auto` como comportamento padrão
- Isso garante que qualquer TabsList com muitas abas faça scroll horizontal automaticamente

**2. Remover `grid grid-cols-N` de todos os 22 arquivos**, substituindo por layout flexível:

| Arquivo | Antes | Depois |
|---------|-------|--------|
| `ConsorcioCardForm.tsx` | `grid w-full grid-cols-5` | `w-full` |
| `WeeklyMetricsDetailDrawer.tsx` | `grid w-full grid-cols-3` | `w-full` |
| `TargetsConfigDialog.tsx` | `grid w-full grid-cols-3` | `w-full` |
| `CloserAvailabilityConfig.tsx` | `grid w-full grid-cols-2` | `w-full` |
| `CRMPermissionsManager.tsx` | `grid w-full grid-cols-3` | `w-full` |
| `R2MeetingDetailDrawer.tsx` | `grid grid-cols-3` | (remove grid) |
| `R2StatusConfigModal.tsx` | `grid w-full grid-cols-2` | `w-full` |
| `Financeiro.tsx` | `grid w-full grid-cols-3` | `w-full` |
| `GRDetail.tsx` | `grid w-full grid-cols-6` | `w-full` |
| `R2Carrinho.tsx` | `grid w-full grid-cols-5` | `w-full` |
| `ContactDetailsDrawer.tsx` | `grid w-full grid-cols-4` | `w-full` |
| `SpreadsheetCompareDialog.tsx` | `grid w-full grid-cols-2` | `w-full` |
| `PlaybookDocEditor.tsx` | `grid w-auto grid-cols-3` | (remove grid) |
| + ~9 outros arquivos | mesmo padrão | mesmo fix |

**3. Garantir `TabsTrigger` com `flex-shrink-0`** para que as abas não sejam comprimidas, mantendo o texto legível.

### Detalhes técnicos

```typescript
// tabs.tsx - TabsList atualizado
className={cn(
  "flex h-10 items-center rounded-md bg-muted p-1 text-muted-foreground overflow-x-auto",
  className,
)}

// tabs.tsx - TabsTrigger atualizado  
className={cn(
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium flex-shrink-0 ...",
  className,
)}
```

### Resultado
Todas as abas do sistema se ajustarão ao conteúdo automaticamente, com scroll horizontal quando necessário, sem overflow ou compressão de texto.

