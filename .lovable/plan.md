

## Fix: Drawer do Controle Diego travado em largura pequena

### Causa raiz
O componente `sheet.tsx` (linha 41) aplica `sm:max-w-sm` (384px) no variant `right`. Essa classe tem maior especificidade que o `w-[820px]` do drawer, travando a largura em 384px.

### Solução
Remover o `sm:max-w-sm` do variant `right` em `src/components/ui/sheet.tsx`. Isso libera o controle de largura para cada componente que usa o Sheet — o `ControleDiegoDrawer` já define `w-[820px] max-w-full`, que passa a funcionar corretamente.

Outros drawers que usam Sheet com `side="right"` já definem suas próprias larguras via className (ex: `R2MeetingDrawer` usa `sm:max-w-md`, `ConversationsDrawer` usa `sm:max-w-2xl`), então não serão afetados.

### Arquivo alterado
- `src/components/ui/sheet.tsx` — linha 41: remover `sm:max-w-sm` do variant `right`

```
// De:
"inset-y-0 right-0 h-full w-3/4  border-l ... sm:max-w-sm"
// Para:
"inset-y-0 right-0 h-full w-3/4  border-l ..."
```

