

## Converter ControleDiegoDrawer de bottom drawer para drawer lateral (Sheet)

### Problema
O drawer atual abre por baixo (bottom), ocupando toda a largura da tela e deixando as informações espalhadas e distantes umas das outras.

### Solução
Trocar o componente `Drawer` (vaul, bottom) por `Sheet` (radix, lateral direito) com largura fixa (~480px), tornando o conteúdo compacto e mais próximo.

### Arquivo a alterar
**`src/components/relatorios/ControleDiegoDrawer.tsx`**

1. Trocar imports de `Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription` por `Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription`
2. Substituir `<Drawer>` → `<Sheet>`, `<DrawerContent>` → `<SheetContent side="right" className="w-[480px] max-w-full p-0 flex flex-col">`
3. Header fixo no topo com `SheetHeader` + padding
4. Conteúdo scrollável em `<div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">`
5. Manter toda a lógica e seções internas (Dados do Contrato, Jornada, A010, Contato, Controle de Vídeo) sem alteração funcional

### Resultado
- Drawer lateral direito, compacto (~480px)
- Informações mais próximas e organizadas verticalmente
- Scroll interno quando necessário
- Mesmo comportamento de abrir/fechar

