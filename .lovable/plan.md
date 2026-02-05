
# Plano: Corrigir Correlacao de Leads Pendentes R2

## Problema Identificado

Quando o R2 e agendado com um deal diferente do R1 (ou o deal nao tem contact_id), a query de pendentes nao consegue correlacionar e o lead permanece na lista.

### Evidencia (Henrique Bergamini):
| Meeting | deal_id | contact_id |
|---------|---------|------------|
| R1 | b3d4fba0... | bee03c2f... |
| R2 | 1e2f6757... | **NULL** |

## Solucao

Melhorar a correlacao em `useR2PendingLeads.ts` para tambem buscar R2 por:
1. `deal_id` (ja existe)
2. `contact_id` (ja existe)
3. **NOVO**: Nome normalizado (attendee_name)
4. **NOVO**: Telefone normalizado

Isso garante que mesmo quando o R2 for agendado com deal diferente ou sem contact_id, o lead sera removido da lista.

---

## Alteracoes no Arquivo

**Arquivo:** `src/hooks/useR2PendingLeads.ts`

### Alteracao 1: Coletar nomes e telefones dos R1 pagos (linha ~76)

Adicionar coleta de nomes e telefones normalizados:

```typescript
const normalizedNames = new Set<string>();
const normalizedPhones = new Set<string>();

const attendeesWithContact = (paidAttendees as any[]).map(a => {
  // ... codigo existente ...
  
  // Coletar nome normalizado
  const name = a.attendee_name?.toLowerCase().trim();
  if (name) normalizedNames.add(name);
  
  // Coletar telefone normalizado (apenas digitos)
  const phone = a.attendee_phone?.replace(/\D/g, '');
  if (phone && phone.length >= 8) normalizedPhones.add(phone);
  
  return { ...a, contact_id: contactId, normalized_name: name, normalized_phone: phone };
});
```

### Alteracao 2: Buscar R2 tambem por nome e telefone (apos linha ~136)

Adicionar query para buscar R2 por nome e telefone:

```typescript
// Step 4b: Get R2 attendees by name/phone (fallback)
const { data: r2ByNamePhone } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    attendee_name,
    attendee_phone,
    meeting_slot:meeting_slots!inner(meeting_type)
  `)
  .eq('meeting_slots.meeting_type', 'r2');

// Create sets of normalized names/phones with R2
const r2Names = new Set<string>();
const r2Phones = new Set<string>();
(r2ByNamePhone || []).forEach(a => {
  const name = a.attendee_name?.toLowerCase().trim();
  if (name) r2Names.add(name);
  const phone = a.attendee_phone?.replace(/\D/g, '');
  if (phone && phone.length >= 8) r2Phones.add(phone);
});
```

### Alteracao 3: Filtrar incluindo nome e telefone (linha ~157)

Atualizar filtro para incluir correlacao por nome/telefone:

```typescript
const pendingLeads = attendeesWithContact
  .filter(a => {
    // 1. Check by contact_id
    if (a.contact_id && contactsWithR2.has(a.contact_id)) {
      return false;
    }
    // 2. Check by deal_id
    if (a.deal_id && dealsWithR2.has(a.deal_id)) {
      return false;
    }
    // 3. Check by normalized name (NEW)
    if (a.normalized_name && r2Names.has(a.normalized_name)) {
      return false;
    }
    // 4. Check by normalized phone (NEW)
    if (a.normalized_phone && r2Phones.has(a.normalized_phone)) {
      return false;
    }
    return true;
  })
```

---

## Fluxo Corrigido

```text
Lista Pendentes (47 leads)
        |
        v
Query verifica se tem R2 por:
  - deal_id OU
  - contact_id OU
  - nome (normalizado) OU    <- NOVO
  - telefone (normalizado)   <- NOVO
        |
        v
Se encontrar R2 por QUALQUER criterio
        |
        v
Lead SAI da lista automaticamente
```

---

## Resultado Esperado

| Situacao | Antes | Depois |
|----------|-------|--------|
| R2 com mesmo deal | Sai da lista | Sai da lista |
| R2 com mesmo contact | Sai da lista | Sai da lista |
| R2 com deal diferente sem contact | **Permanece** | Sai da lista |
| R2 com mesmo nome | **Permanece** | Sai da lista |
| R2 com mesmo telefone | **Permanece** | Sai da lista |

---

## Secao Tecnica

### Arquivo a Modificar
- `src/hooks/useR2PendingLeads.ts`

### Funcoes de Normalizacao
```typescript
// Nome: lowercase + trim
const normalizedName = attendee_name?.toLowerCase().trim();

// Telefone: apenas digitos, min 8 chars
const normalizedPhone = phone?.replace(/\D/g, '');
```

### Performance
- Uma query adicional para buscar nomes/telefones dos R2
- Comparacao em memoria usando Sets (O(1) lookup)
- Impacto minimo na performance

### Cache
Nenhuma alteracao necessaria - o cache ja invalida `r2-pending-leads` quando R2 e criada.
