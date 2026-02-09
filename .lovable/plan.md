
# Salvar telefone em deals sem contato vinculado

## Problema

Quando um deal nao tem `contact_id` (contato nao existe na tabela `crm_contacts`), o sistema bloqueia a edicao de telefone com a mensagem "Nenhum contato vinculado a este negocio". O usuario precisa conseguir salvar o telefone independentemente.

## Solucao

Quando nao houver contato vinculado ao deal, o sistema deve **criar automaticamente um contato** com o nome do deal e o telefone informado, e depois vincular esse contato ao deal.

## Fluxo

1. Usuario clica no icone de editar telefone
2. Digita o numero e clica em salvar
3. **Se existe contato**: atualiza o telefone no contato existente (comportamento atual)
4. **Se NAO existe contato**: 
   - Cria um novo registro em `crm_contacts` com `name = deal.name` e `phone = telefone digitado`
   - Atualiza o deal com `contact_id` apontando para o novo contato
   - Invalida os caches para o drawer refletir a mudanca

## Alteracoes tecnicas

### Arquivo: `src/components/crm/SdrSummaryBlock.tsx`

Importar `useCreateCRMContact` e o `supabase` client. Alterar `handleSavePhone` para:

```text
const handleSavePhone = async () => {
  if (!phoneValue.trim()) {
    toast.error('Digite um número de telefone');
    setEditingPhone(false);
    return;
  }

  try {
    if (contact?.id) {
      // Contato existe: atualizar telefone
      await updateContact.mutateAsync({
        id: contact.id,
        phone: phoneValue
      });
      toast.success('Telefone atualizado');
    } else if (deal?.id) {
      // Contato NAO existe: criar contato e vincular ao deal
      const newContact = await createContact.mutateAsync({
        name: deal.name || 'Contato sem nome',
        phone: phoneValue
      });
      // Vincular contato ao deal
      await supabase
        .from('crm_deals')
        .update({ contact_id: newContact.id })
        .eq('id', deal.id);
      // Invalidar cache do deal para refletir vinculo
      queryClient.invalidateQueries({ queryKey: ['crm-deal'] });
      toast.success('Contato criado e telefone salvo');
    }
    setEditingPhone(false);
  } catch (error) {
    toast.error('Erro ao salvar telefone');
  }
};
```

### Imports adicionais em SdrSummaryBlock.tsx

- Adicionar `useCreateCRMContact` do hook `useCRMData`
- Adicionar `useQueryClient` do `@tanstack/react-query`
- Adicionar `supabase` de `@/integrations/supabase/client`

### Resultado

- Deals com contato: telefone e atualizado normalmente
- Deals sem contato: contato e criado automaticamente com o nome do deal e vinculado
- O drawer atualiza imediatamente apos salvar
- Nao aparece mais o erro "Nenhum contato vinculado"
