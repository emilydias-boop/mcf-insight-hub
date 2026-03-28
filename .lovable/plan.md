

## Fix: Canal mostra "—" para Wilmar (A010) e leads ANAMNESE

### Causa raiz confirmada

O relatório só busca A010 e deals **por email**. Quando o email do contrato não bate exatamente com o email da compra A010 ou do deal CRM, os dados ficam vazios:

- **Wilmar**: Tem R1, R2, Closer — ou seja, o `contact_id` existe e tem reuniões. Mas `dealMap` não tem deal para esse contact, então tags e canal ficam nulos. O A010 também não é encontrado porque a query `a010Map` só busca por email.
- **ANAMNESE**: O phone fallback (linha 364-420) já tenta buscar deals por telefone quando não há deal pelo email-contact, mas falha se o contato alternativo também não tem deals, ou se a busca de deals do phone fallback não popula corretamente.

### Correção

**`src/hooks/useCarrinhoAnalysisReport.ts`**:

1. **A010 por telefone**: Após construir `a010Map` por email, fazer uma segunda busca de A010 por telefone (suffix 9 dígitos) para leads que ficaram sem `a010Date`. Isso resolve Wilmar e similares.

2. **Fallback de canal sem deal**: Na IIFE do `canalEntrada` (linha 587-609), quando `deal` é null mas `a010Date` existe, o fallback `HUBLA (A010)` na linha 607 já deveria funcionar. O problema é que `a010Date` está null porque a busca só é por email. Resolvendo o item 1, isso se resolve automaticamente.

3. **Busca de deals mais agressiva por telefone**: O phone fallback atual (linhas 364-484) já re-fetcha deals para novos contacts encontrados por telefone. Mas o filtro na linha 371 `!dealMap.has(contactId)` pode falhar se o contact via email existe mas não tem deals E o phone match também não acha deals. Vou adicionar um fallback final: se após tudo o deal ainda é null, tentar buscar deals diretamente por telefone no `crm_contacts` sem depender do contactMap intermediário.

### Detalhes técnicos

```typescript
// 1. Após a010Map por email, buscar por telefone para os que ficaram sem
const emailsWithoutA010 = emails.filter(e => !a010Map.has(e));
const phonesForA010 = new Map<string, string>(); // suffix -> email
for (const tx of uniqueContracts) {
  const email = (tx.customer_email || '').toLowerCase().trim();
  if (!a010Map.has(email)) {
    const suffix = normalizePhoneSuffix(tx.customer_phone);
    if (suffix) phonesForA010.set(suffix, email);
  }
}
// Query hubla_transactions A010 by phone suffix
for (const [suffix, email] of phonesForA010) {
  const { data } = await supabase.from('hubla_transactions')
    .select('customer_email, sale_date')
    .or('product_category.eq.a010,product_name.ilike.%a010%')
    .ilike('customer_phone', `%${suffix}`)
    .order('sale_date', { ascending: true })
    .limit(1);
  if (data?.[0]) a010Map.set(email, data[0].sale_date);
}
```

### Arquivos alterados
- `src/hooks/useCarrinhoAnalysisReport.ts`

