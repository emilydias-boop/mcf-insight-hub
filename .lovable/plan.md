

## Vincular contratos antigos e de outros contatos

### Problema atual

O dialog "Vincular Contrato" tem duas limitacoes que impedem vincular esse caso:

1. **Limite de 14 dias** - so mostra transacoes dos ultimos 14 dias
2. **Filtro rigido** - so busca `product_category = 'contrato'`; um pagamento de R$ 397 pode ter outra categoria

### Solucao

Adicionar um modo de **busca ampliada** no `LinkContractDialog`, permitindo buscar transacoes em todo o historico quando o usuario digitar algo no campo de busca.

**Alteracoes:**

**1. `src/hooks/useUnlinkedContracts.ts`**
- Adicionar um parametro opcional `searchAll: boolean` ao hook
- Quando `searchAll = true`, remover o filtro de 14 dias e o filtro de `product_category`
- Manter o filtro `linked_attendee_id IS NULL` para so mostrar transacoes ainda nao vinculadas
- Adicionar filtro de busca server-side (por email, nome ou telefone) para performance

**2. `src/components/crm/LinkContractDialog.tsx`**
- Adicionar um toggle/checkbox "Buscar em todo o historico" abaixo do campo de busca
- Quando ativado, o hook passa `searchAll = true` e envia o termo de busca para o servidor
- Mostrar um aviso indicando que a busca ampliada pode retornar mais resultados
- Exibir o `product_name` e `product_category` de cada transacao para o usuario identificar o contrato correto

### Detalhes tecnicos

No hook `useUnlinkedContracts`, a query ampliada ficaria:

```
supabase
  .from('hubla_transactions')
  .select('id, hubla_id, customer_name, customer_email, customer_phone, sale_date, net_value, product_price, product_name, product_category')
  .is('linked_attendee_id', null)
  .or(`customer_email.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`)
  .order('sale_date', { ascending: false })
  .limit(50)
```

Sem filtro de data nem de categoria, mas com busca obrigatoria (minimo 3 caracteres) para evitar trazer milhares de registros.

### Resultado

O usuario podera buscar qualquer transacao historica por nome, email ou telefone, identificar o pagamento de R$ 397 e vincular ao attendee correto.
