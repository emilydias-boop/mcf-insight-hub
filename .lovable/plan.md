

## Mover aba "Pagamentos" para página própria no menu do Consórcio

### O que muda

Remover a aba "Pagamentos" da página "Controle Consórcio" (que ficará apenas com Cotas, Cadastros Pendentes e Contemplação) e criar uma rota/página dedicada `/consorcio/pagamentos` com item próprio no sidebar.

### Arquivos afetados

1. **`src/pages/bu-consorcio/Index.tsx`**
   - Remover import do `ConsorcioPagamentosTab`
   - Remover `<TabsTrigger value="pagamentos">` e `<TabsContent value="pagamentos">`

2. **`src/pages/bu-consorcio/Pagamentos.tsx`** (novo)
   - Página wrapper que renderiza `ConsorcioPagamentosTab` com o seletor de mês (reutilizando o mesmo padrão de selectedMonth já existente)

3. **`src/App.tsx`**
   - Adicionar rota `consorcio/pagamentos` apontando para a nova página

4. **`src/components/layout/AppSidebar.tsx`**
   - Adicionar item `{ title: "Pagamentos", url: "/consorcio/pagamentos" }` no menu BU Consórcio (abaixo de "Controle Consorcio")

O componente `ConsorcioPagamentosTab` e todo o hook `useConsorcioPagamentos` permanecem inalterados — apenas mudam de local de renderização.

