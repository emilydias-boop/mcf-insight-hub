
# Plano: Buscar Closer R1 Mais Recente por Contato (Nao por Deal)

## Problema Identificado

Eduardo Spadaro tem dois deals diferentes:
- Deal A (Julio, 29/01): status `contract_paid`
- Deal B (Cristiane, 04/02): status `no_show`

O Step 7 atual busca reunioes apenas pelo `deal_id` do registro com `contract_paid`, ignorando outros deals do mesmo contato.

## Solucao

Modificar o Step 7 para buscar a R1 mais recente por **contact_id** em vez de **deal_id**.

---

## Alteracoes

### Arquivo: `src/hooks/useR2PendingLeads.ts`

#### 1. Coletar todos os deal_ids de todos os contatos (linhas 216-219)

**Antes:**
```typescript
const dealIdsForLatestCloser = pendingLeads
  .filter(a => a.deal_id)
  .map(a => a.deal_id as string);
```

**Depois:**
```typescript
// Collect all deal_ids for all contacts (to find meetings across all their deals)
const contactIdsForLatestCloser = new Set<string>();
pendingLeads.forEach(lead => {
  if (lead.contact_id) contactIdsForLatestCloser.add(lead.contact_id);
});

// Get all deal_ids for these contacts (we already have this from Step 3)
const allDealIdsForContacts = new Set<string>();
contactIdsForLatestCloser.forEach(contactId => {
  const deals = contactToDealIds.get(contactId);
  if (deals) deals.forEach(d => allDealIdsForContacts.add(d));
});
```

#### 2. Atualizar a query para usar todos os deals dos contatos (linhas 221-234)

**Antes:**
```typescript
if (dealIdsForLatestCloser.length > 0) {
  const { data: latestAttendees } = await supabase
    ...
    .in('deal_id', dealIdsForLatestCloser)
```

**Depois:**
```typescript
if (allDealIdsForContacts.size > 0) {
  const { data: latestAttendees } = await supabase
    ...
    .in('deal_id', Array.from(allDealIdsForContacts))
```

#### 3. Criar mapeamento contact_id -> closer (em vez de deal_id -> closer)

**Antes:**
```typescript
const latestCloserMap = new Map<string, { id: string; name: string } | null>();
sortedAttendees.forEach(att => {
  if (att.deal_id && !latestCloserMap.has(att.deal_id)) {
    latestCloserMap.set(att.deal_id, att.closer || null);
  }
});
```

**Depois:**
```typescript
// Create map: contact_id -> most recent closer (across all deals)
const latestCloserByContact = new Map<string, { id: string; name: string } | null>();

sortedAttendees.forEach(att => {
  if (!att.deal_id) return;
  // Find which contact owns this deal
  for (const [contactId, dealSet] of contactToDealIds.entries()) {
    if (dealSet.has(att.deal_id) && !latestCloserByContact.has(contactId)) {
      latestCloserByContact.set(contactId, att.closer || null);
      break;
    }
  }
});
```

#### 4. Atualizar o enriquecimento para usar contact_id (linhas 261-274)

**Antes:**
```typescript
return pendingLeads.map(lead => {
  const latestCloser = lead.deal_id ? latestCloserMap.get(lead.deal_id) : null;
```

**Depois:**
```typescript
return pendingLeads.map(lead => {
  const latestCloser = lead.contact_id ? latestCloserByContact.get(lead.contact_id) : null;
```

---

## Fluxo de Dados Corrigido

```text
Eduardo Spadaro (contact_id: X)
    |
    +-- Deal A (Julio, 29/01, contract_paid) <-- registro original
    +-- Deal B (Cristiane, 04/02, no_show)   <-- reuniao mais recente
    |
    V
Step 7 busca R1s de TODOS os deals do contact X
    |
    V
Ordena por data DESC -> Cristiane (04/02) eh o mais recente
    |
    V
Mapeia contact X -> Cristiane
    |
    V
Eduardo aparece com Cristiane como Closer R1
```

---

## Resultado Esperado

Eduardo Spadaro aparecera corretamente sob o filtro **Cristiane Gomes** (reuniao R1 mais recente em 04/02), independente de em qual deal o contrato foi pago.
