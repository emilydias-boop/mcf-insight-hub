
# Corrigir salvamento de telefone no lead

## Problema

Ao editar o telefone no bloco "CONTATO" do drawer do deal e clicar no check verde, o numero nao salva e nao persiste. Existem dois bugs:

### Bug 1: Cache nao atualiza apos salvar
O hook `useUpdateCRMContact` invalida apenas `['crm-contacts']` (lista), mas NAO invalida `['crm-contact', id]` (contato individual usado pelo drawer). Resultado: o telefone salva no banco, mas o drawer continua mostrando o valor antigo.

### Bug 2: Deal sem contato vinculado
Se o deal nao tiver `contact_id` (contato nao existe), `handleSavePhone` verifica `if (!contact?.id) return;` e sai silenciosamente, sem mostrar nenhum erro ao usuario.

## Correcoes

### 1. Invalidar cache do contato individual (`src/hooks/useCRMData.ts`)

No `useUpdateCRMContact`, adicionar invalidacao de `['crm-contact']` para que o drawer atualize:

```text
onSuccess: (data) => {
  queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
  queryClient.invalidateQueries({ queryKey: ['crm-contact'] });
  queryClient.invalidateQueries({ queryKey: ['crm-deal'] });
  toast.success('Contato atualizado com sucesso');
},
```

Invalida tambem `['crm-deal']` porque o deal carrega `crm_contacts(name, email, phone)` via join.

### 2. Feedback ao usuario quando nao ha contato (`src/components/crm/SdrSummaryBlock.tsx`)

Alterar `handleSavePhone` para mostrar erro quando nao existe contato vinculado:

```text
const handleSavePhone = async () => {
  if (!contact?.id) {
    toast.error('Nenhum contato vinculado a este negocio');
    setEditingPhone(false);
    return;
  }
  // ... resto do codigo
};
```

## Secao Tecnica

- **Arquivo 1**: `src/hooks/useCRMData.ts` — linhas 355-358, adicionar invalidacoes extras no `onSuccess`
- **Arquivo 2**: `src/components/crm/SdrSummaryBlock.tsx` — linhas 28-29, adicionar toast de erro quando contact e null
- Nenhuma alteracao de banco de dados necessaria
