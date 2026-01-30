
# Correção: Popup de Edição Mostrando Formulário de Criação

## O Problema

Quando você clica no botão "Editar" (ícone de lápis) em uma venda do Carrinho R2, o popup que abre é o mesmo de "Nova Venda de Parceria" porque:

1. O componente `R2CarrinhoTransactionFormDialog` não recebe os dados da venda selecionada
2. Não existe distinção entre modo "criar" e modo "editar"
3. O título é fixo como "Nova Venda de Parceria"
4. O botão sempre diz "Criar Venda"

## Solução Proposta

### Etapa 1: Modificar o componente R2CarrinhoTransactionFormDialog

Adicionar props opcionais para modo de edição:

```typescript
interface R2CarrinhoTransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStart: Date;
  // Novas props para edição
  editMode?: boolean;
  transactionToEdit?: {
    id: string;
    product_name: string;
    product_price: number;
    net_value: number;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    sale_date: string;
    linked_attendee_id?: string;
  };
}
```

### Etapa 2: Preencher formulário com dados existentes

Quando `editMode=true` e `transactionToEdit` existir:
- Pré-preencher todos os campos com os valores da transação
- Mudar título para "Editar Venda de Parceria"
- Mudar botão para "Salvar Alterações"

### Etapa 3: Criar hook useUpdateCarrinhoTransaction

Novo hook para atualizar transação existente (UPDATE em vez de INSERT).

### Etapa 4: Atualizar R2VendasList

Passar os dados da venda selecionada para o dialog de edição:

```tsx
{selectedVenda && editDialogOpen && (
  <R2CarrinhoTransactionFormDialog
    open={editDialogOpen}
    onOpenChange={setEditDialogOpen}
    weekStart={weekStart}
    editMode={true}
    transactionToEdit={{
      id: selectedVenda.id,
      product_name: selectedVenda.product_name,
      // ... demais campos
    }}
  />
)}
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/R2CarrinhoTransactionFormDialog.tsx` | Adicionar props de edição, lógica de preenchimento e título dinâmico |
| `src/components/crm/R2VendasList.tsx` | Passar dados da venda selecionada para o dialog |
| `src/hooks/useUpdateCarrinhoTransaction.ts` | Novo hook para update de transação (se não existir) |

## Resultado Esperado

- Ao clicar em "Editar", o popup abre com:
  - Título: "Editar Venda de Parceria"
  - Campos pré-preenchidos com dados da venda
  - Botão: "Salvar Alterações"
- Ao salvar, atualiza a transação existente em vez de criar nova
