
# Corrigir scroll do drawer de leads

## Problema
O `SheetContent` tem `overflow-y-auto` enquanto o container interno tambem tem `overflow-y-auto`. Isso cria um conflito: o SheetContent expande para caber todo o conteudo, entao o scroll interno nunca ativa. Quando o conteudo excede a tela, ninguem scrolla corretamente.

## Correcao

### Arquivo: `src/components/crm/DealDetailsDrawer.tsx`

Trocar `overflow-y-auto` por `overflow-hidden` no `SheetContent` (linha 76). O scroll deve ficar apenas no container interno (`flex-1 overflow-y-auto` na linha 97), que ja esta configurado corretamente.

**De:**
```
<SheetContent className="bg-card border-border w-full sm:max-w-2xl overflow-y-auto p-0">
```

**Para:**
```
<SheetContent className="bg-card border-border w-full sm:max-w-2xl overflow-hidden p-0">
```

1 arquivo, 1 linha alterada.
