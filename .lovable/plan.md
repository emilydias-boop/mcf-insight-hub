

# Corrigir Scroll do Drawer de Leads

## Causa raiz
O componente `SheetContent` (sheet.tsx) usa `position: fixed` com `h-full`, mas nao tem `display: flex` nem `flex-direction: column` nas classes base. O div interno `flex flex-col h-full` nao consegue se restringir a altura do pai porque o pai nao e um container flex. Resultado: o conteudo transborda sem scroll.

## Correcao

### Arquivo: `src/components/crm/DealDetailsDrawer.tsx`

Adicionar `flex flex-col` ao className do `SheetContent` para que o layout flex interno funcione corretamente:

**De:**
```
<SheetContent className="bg-card border-border w-full sm:max-w-2xl overflow-hidden p-0">
```

**Para:**
```
<SheetContent className="bg-card border-border w-full sm:max-w-2xl overflow-hidden p-0 flex flex-col">
```

E remover o div wrapper `flex flex-col h-full` redundante (linha 92), deixando os filhos diretos no SheetContent.

Alternativa mais simples (sem remover o wrapper): manter o wrapper mas garantir que o SheetContent tenha `flex flex-col` para que `h-full` do wrapper funcione.

1 arquivo, 1 linha alterada.

