

## Plano: Filtrar lifecycle por Inside Sales + lookup cross-pipeline de R2

### Problema
1. **Leads de outras pipelines** (ex: Parcerias) aparecem como "Pendente" porque a query de R1 não filtra por pipeline
2. **R2s de deals replicados** não são encontradas porque a query busca R2 apenas pelo `deal_id` original do R1, ignorando deals replicados via `contact_id`

### Alterações em `src/hooks/useContractLifecycleReport.ts`

**Passo 1 — Adicionar `contact_id` e `origin_id` ao select do deal (linha 137-141)**
```ts
deal:crm_deals(
  id, name, contact_id, origin_id,
  contact:crm_contacts(name, phone, email)
)
```

**Passo 2 — Buscar origins de Inside Sales e filtrar R1 attendees (após linha 148)**
- Buscar `crm_origins` com nome contendo "inside" (case-insensitive)
- Filtrar `r1Attendees` client-side: manter apenas deals cujo `origin_id` pertence à pipeline Inside Sales
- Isso elimina leads de Parcerias, Consórcio, etc.

**Passo 3 — Coletar `contact_id` e buscar deals irmãos (antes do Step 4, ~linha 173)**
- Criar mapa `contactId → [dealIds originais do R1]`
- Buscar todos os deals dos mesmos contatos via `supabase.from('crm_deals').select('id, contact_id').in('contact_id', contactIds)`
- Expandir a lista de `dealIds` usada na query R2 para incluir esses deals irmãos
- Criar mapa reverso `siblingDealId → originalR1DealId`

**Passo 4 — Expandir query R2 e mapear de volta (linhas 189-229)**
- Usar lista expandida `[...allDealIds]` no `.in('deal_id', ...)` da query R2
- No loop de construção do `r2Map`, se o `deal_id` é de um deal irmão, usar o `deal_id` original do R1 como chave

### Seção técnica

```ts
// Passo 1: select expandido
deal:crm_deals(id, name, contact_id, origin_id, contact:crm_contacts(name, phone, email))

// Passo 2: filtrar por Inside Sales
const { data: insideOrigins } = await supabase
  .from('crm_origins').select('id').ilike('name', '%inside%');
const insideOriginIds = new Set((insideOrigins || []).map(o => o.id));
const filteredR1 = (r1Attendees || []).filter((a: any) => {
  const originId = a.deal?.origin_id;
  return originId && insideOriginIds.has(originId);
});

// Passo 3: deals irmãos via contact_id
const contactToDealMap = new Map<string, string[]>();
for (const att of filteredR1 as any[]) {
  const cid = att.deal?.contact_id;
  const did = att.deal_id;
  if (cid && did) {
    if (!contactToDealMap.has(cid)) contactToDealMap.set(cid, []);
    contactToDealMap.get(cid)!.push(did);
  }
}
const contactIds = [...contactToDealMap.keys()];
const { data: siblingDeals } = await supabase
  .from('crm_deals').select('id, contact_id').in('contact_id', contactIds);

const allDealIds = new Set(dealIds);
const siblingToOriginal = new Map<string, string>();
for (const sd of siblingDeals || []) {
  allDealIds.add(sd.id);
  if (!dealIds.includes(sd.id)) {
    const originals = contactToDealMap.get(sd.contact_id!) || [];
    if (originals.length > 0) siblingToOriginal.set(sd.id, originals[0]);
  }
}

// Passo 4: query R2 com lista expandida
.in('deal_id', [...allDealIds])
// No loop r2Map:
const mappedDealId = siblingToOriginal.get(r2.deal_id) || r2.deal_id;
r2Map[mappedDealId] = { ... };
```

Apenas `useContractLifecycleReport.ts` será alterado.

