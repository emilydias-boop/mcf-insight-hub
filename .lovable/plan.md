

## Problema: Conteúdo transbordando em vários locais do sistema

### Diagnóstico

O problema principal está no uso de `grid-cols-N` fixo em espaços limitados, combinado com o `font-size: 50%` (base 8px). O caso mais visível é o `EmployeeDrawer.tsx` que usa `grid-cols-8` para as abas (Geral, Rem., NFSe, Docs, Hist., Notas, Perm., Aval.) dentro de um drawer de `max-w-2xl`. Com 8 colunas fixas, cada aba tem apenas ~80px, insuficiente para ícone + texto.

Este padrão (muitas colunas em grid fixo ou conteúdo sem overflow handling) se repete em outros locais do sistema.

### Correção proposta

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `src/components/hr/EmployeeDrawer.tsx` | Substituir `grid grid-cols-${tabCount}` por layout flexível com scroll horizontal (`flex overflow-x-auto`), removendo o grid fixo |
| 2 | `src/components/ui/tabs.tsx` | Adicionar variante para `TabsList` que suporte scroll horizontal quando há muitas abas |

### Detalhes técnicos

**EmployeeDrawer.tsx (linha 93):**
```typescript
// Antes:
<TabsList className={`grid w-full grid-cols-${tabCount}`}>

// Depois:
<TabsList className="flex w-full overflow-x-auto">
```

Cada `TabsTrigger` mantém `flex items-center gap-1` mas remove `whitespace-nowrap` implícito do grid, permitindo que as abas ocupem o espaço necessário e façam scroll se não couberem.

**tabs.tsx - TabsList:**
Ajustar o `inline-flex` para aceitar `overflow-x-auto` sem quebrar o layout padrão, adicionando `scrollbar-hide` para estética.

### Resultado esperado
As abas se ajustam ao espaço disponível, com scroll horizontal quando necessário, sem transbordar ou sobrepor outros elementos. Isso resolve o problema no drawer do colaborador e pode ser aplicado em outros locais similares.

