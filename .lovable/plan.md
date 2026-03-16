

## Problema: Contrato não reconhecido quando contato não tem email

### Raiz do problema

Duas falhas na cadeia de dados:

1. **`webhook-make-contrato`**: Quando o lead compra um contrato com nome completo + telefone + email, o webhook faz match por telefone (via `autoMarkContractPaid`) e marca a reunião como paga. Porém, **não enriquece o `crm_contacts`** com o email da compra. O contato continua sem email no CRM.

2. **`useLeadPurchaseHistory`**: A aba "Produtos" no drawer do lead busca compras usando `customer_email` da tabela `hubla_transactions`. Se o contato no CRM não tem email, retorna vazio -- mesmo que a transação exista com o mesmo telefone.

### Solução

**1. Enriquecer contato no webhook (`webhook-make-contrato/index.ts`)**

Após o match por telefone no `autoMarkContractPaid`, adicionar lógica para:
- Buscar o `crm_contacts` vinculado ao deal do attendee
- Se o contato não tem email mas a compra tem, atualizar o contato com o email
- Se o contato não tem `clint_id` mas a compra tem telefone, enriquecer também

Inserir isso após a linha ~168 (depois de marcar attendee como contract_paid), antes da notificação. Aproximadamente 20 linhas de código.

**2. Busca por telefone no histórico de compras (`useLeadPurchaseHistory.ts`)**

Alterar o hook para aceitar também `phone` como parâmetro de busca:
- Se tem email, busca por email (comportamento atual)
- Se não tem email mas tem telefone, busca por `customer_phone` usando sufixo de 9 dígitos
- Se tem ambos, busca por email OR telefone (`.or()`)

Isso garante que a aba "Produtos" mostre compras mesmo sem email no contato.

**3. Atualizar chamadas do hook**

Qualquer componente que usa `useLeadPurchaseHistory(email)` precisa passar também o telefone. O R2NotesTab já tem acesso a `attendee?.deal?.contact?.phone`.

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/webhook-make-contrato/index.ts` -- enriquecer crm_contacts com email após match por telefone |
| Editar | `src/hooks/useLeadPurchaseHistory.ts` -- aceitar phone, buscar por email OR phone suffix |
| Editar | `src/components/crm/r2-drawer/R2NotesTab.tsx` -- passar phone ao hook |
| Deploy | `webhook-make-contrato` |

