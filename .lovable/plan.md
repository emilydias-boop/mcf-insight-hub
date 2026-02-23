

# Fix: Notas do Lead nao aparecem no Consorcio

## Causa Raiz

O deal "Matheus Brigatto" no Consorcio (`aeaea21b`) tem:
- `contact_id = NULL`
- `replicated_from_deal_id = NULL`
- Nome = "Matheus Brigatto"

O fallback por nome no `useContactDealIds` usa `.maybeSingle()` para buscar o contato, mas existem **4 contatos** com o nome "Matheus Brigatto" na tabela `crm_contacts`. O metodo `.maybeSingle()` retorna `null` quando encontra mais de um resultado, fazendo o hook retornar apenas o deal atual (sem notas cross-pipeline).

O contato correto e `40d3a5bb` (o unico com deals vinculados).

## Solucao

### Arquivo: `src/hooks/useContactDealIds.ts`

Duas correcoess:

**1. Fallback por nome: trocar `.maybeSingle()` por query que prioriza contato com deals**

Em vez de buscar qualquer contato pelo nome, buscar o contato que efetivamente tenha deals vinculados. Usar `.limit(1)` e acessar `data?.[0]` em vez de `.maybeSingle()`.

Logica melhorada:
```text
// Antes (quebra com duplicatas):
.ilike('name', deal.name.trim())
.limit(1)
.maybeSingle()

// Depois (busca contato que tem deals):
1. Buscar contatos pelo nome com .ilike()
2. Se encontrar apenas 1, usar esse
3. Se encontrar varios, buscar qual tem deals vinculados
4. Usar o primeiro com deals, ou o primeiro da lista como fallback
```

**2. Adicionar Fallback #3: busca por email/telefone via crm_contacts**

Se o deal nao tem `contact_id` nem `replicated_from_deal_id`, e o nome nao resolve, tentar buscar pelo email do contato (se disponivel via o drawer).

### Detalhes Tecnicos

No `useContactDealIds.ts`, a secao de fallback por nome (linhas 38-47) sera substituida por:

```text
// Fallback 2: match by deal name - handle duplicates
if (!resolvedContactId && deal?.name) {
  const { data: contacts } = await supabase
    .from('crm_contacts')
    .select('id')
    .ilike('name', deal.name.trim());
  
  if (contacts?.length === 1) {
    resolvedContactId = contacts[0].id;
  } else if (contacts && contacts.length > 1) {
    // Multiple contacts with same name - find which has deals
    const contactIds = contacts.map(c => c.id);
    const { data: dealsForContacts } = await supabase
      .from('crm_deals')
      .select('contact_id')
      .in('contact_id', contactIds)
      .limit(1);
    resolvedContactId = dealsForContacts?.[0]?.contact_id || contacts[0].id;
  }
}
```

## Arquivos a Modificar

1. `src/hooks/useContactDealIds.ts` - Corrigir fallback por nome para lidar com contatos duplicados

## Resultado Esperado

Ao abrir "Matheus Brigatto" no Consorcio, o hook vai:
1. Ver que `contact_id` e null
2. Ver que `replicated_from_deal_id` e null
3. Buscar contatos com nome "Matheus Brigatto" -> encontra 4
4. Buscar qual deles tem deals -> encontra `40d3a5bb`
5. Buscar todos os deals de `40d3a5bb` -> encontra 3 deals (Inside Sales + 2 replicados)
6. Retornar todos os IDs, permitindo que as notas de agendamento e qualificacao aparecam

