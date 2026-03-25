

## Fix: Erro FK ao excluir leads com registros de consórcio

### Problema
Ao excluir um deal, o cascade tenta deletar `consorcio_pending_registrations`, mas `consortium_documents.pending_registration_id` não tem CASCADE, causando o erro FK.

### Esclarecimento do usuário
A exclusão deve remover apenas o registro do CRM (deal), **sem apagar** a carta de consórcio (`consortium_cards`). Apenas os vínculos intermediários (`consorcio_pending_registrations` e seus `consortium_documents`) precisam ser limpos.

### Solução
No `src/hooks/useDeleteDeals.ts`, adicionar antes do `delete crm_deals`:

1. Buscar `consorcio_pending_registrations` vinculados ao deal (`deal_id = id`)
2. Para cada registration encontrado, deletar `consortium_documents` onde `pending_registration_id` = registration.id
3. Deletar os `consorcio_pending_registrations` do deal

```typescript
// Antes de deletar o deal, limpar consórcio pending registrations
const { data: pendingRegs } = await supabase
  .from('consorcio_pending_registrations')
  .select('id')
  .eq('deal_id', id);

if (pendingRegs && pendingRegs.length > 0) {
  const regIds = pendingRegs.map(r => r.id);
  await supabase.from('consortium_documents').delete().in('pending_registration_id', regIds);
  await supabase.from('consorcio_pending_registrations').delete().in('id', regIds);
}
```

### Arquivo alterado
- `src/hooks/useDeleteDeals.ts` — adicionar limpeza de pending registrations e seus documentos

