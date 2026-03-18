

## Plano: Corrigir "Contato não encontrado" no Drawer

### Problema
O `ContactDetailsDrawer` usa `useCRMContacts()` que carrega **todos** os contatos da tabela, e depois faz `.find(id)`. Com uma base grande, o contato buscado pode não estar no resultado (limite de linhas do Supabase ou timeout), resultando em "Contato não encontrado".

### Solução
Substituir a busca em lista por uma query direta por ID.

**Arquivo:** `src/components/crm/ContactDetailsDrawer.tsx`

Trocar:
```typescript
const { data: contacts, isLoading } = useCRMContacts();
const contactData = contacts?.find((c: any) => c.id === contactId);
```

Por uma query dedicada que busca o contato diretamente:
```typescript
const { data: contactData, isLoading } = useQuery({
  queryKey: ['crm-contact-detail', contactId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('id', contactId!)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  enabled: !!contactId && open,
});
```

Isso elimina a dependência de carregar toda a tabela e garante que qualquer contato existente seja encontrado.

