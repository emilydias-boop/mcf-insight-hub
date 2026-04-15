

## Plano: Adicionar coluna "Dia Compra" na tabela do Carrinho R2

### O que será feito
Adicionar uma coluna **"Dia Compra"** na tabela da aba "Todas R2s" do Carrinho R2, mostrando a data em que o contrato foi pago (`contract_paid_at`), que já está disponível nos dados carregados.

### Arquivo alterado

**`src/components/crm/R2AgendadasList.tsx`**
- Adicionar `<TableHead>` "Dia Compra" entre "Dia R1" e "Status"
- Adicionar `<TableCell>` formatando `att.contract_paid_at` como `dd/MM` (ou `-` quando não houver)

### Detalhes técnicos
- O campo `contract_paid_at` já existe na interface `R2CarrinhoAttendee` e é retornado pelo hook `useR2CarrinhoData`
- Nenhuma query ou fetch adicional necessário
- Formato: `dd/MM` consistente com a coluna "Dia R1" existente

