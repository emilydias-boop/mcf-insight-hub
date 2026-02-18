

# Correção: Closers e SDRs não aparecem no relatório de Aquisição

## Problema Identificado

Encontrei **2 bugs** no hook `useAcquisitionReport.ts`:

### Bug 1: Coluna errada no SELECT do Supabase
O código busca `crm_deals!deal_id(owner, ...)` mas a coluna correta é `owner_id` (não `owner`). O PostgREST silenciosamente retorna `null` para colunas inexistentes, fazendo todos os attendees ficarem sem SDR.

### Bug 2: SDR owner_id é email, não UUID
O campo `owner_id` da tabela `crm_deals` contém **emails** (ex: `jessica.bellini@minhacasafinanciada.com`), não UUIDs. Porém existe `owner_profile_id` que contém o UUID correto do profile. O código atual tenta buscar nomes na tabela `profiles` usando o `owner` como UUID — isso nunca funciona.

Esses 2 bugs combinados fazem com que:
- **Nenhum attendee** tenha SDR associado → tudo vira "Sem SDR"
- **Sem attendee válido**, o match por email/telefone falha (os dados de contato vêm do `crm_contacts` via `crm_deals`) → tudo vira "Sem Closer"

## Evidência

Verificação direta no banco:
- 1.520 attendees R1 existem no período (jan-fev 2026)
- 1.238 transações Hubla têm match por email com contatos da agenda
- Mas o hook retorna 0 matches porque o campo `owner` não existe

## Correção

Arquivo: `src/hooks/useAcquisitionReport.ts`

### Alteração 1: Corrigir o SELECT (linha 107)

```
// DE:
crm_deals!deal_id(owner, crm_contacts!contact_id(email, phone))

// PARA:
crm_deals!deal_id(owner_id, owner_profile_id, crm_contacts!contact_id(email, phone))
```

### Alteração 2: Atualizar o tipo `AttendeeWithSDR` (linhas 37-46)

```
// DE:
crm_deals: {
  owner: string | null;
  crm_contacts: { ... } | null;
} | null;

// PARA:
crm_deals: {
  owner_id: string | null;
  owner_profile_id: string | null;
  crm_contacts: { ... } | null;
} | null;
```

### Alteração 3: Usar `owner_profile_id` para buscar nomes de SDR (linhas 127-128)

```
// DE:
if (a.crm_deals?.owner) ids.add(a.crm_deals.owner);

// PARA:
if (a.crm_deals?.owner_profile_id) ids.add(a.crm_deals.owner_profile_id);
```

### Alteração 4: Usar `owner_profile_id` na classificação (linha 205)

```
// DE:
const sdrId = matchedAttendee?.crm_deals?.owner || null;

// PARA:
const sdrId = matchedAttendee?.crm_deals?.owner_profile_id || null;
```

### Resultado Esperado

Com essas 4 correções:
- Os 1.238+ matches por email voltam a funcionar → Closers aparecem corretamente
- O `owner_profile_id` (UUID) casa com `profiles.id` → SDRs aparecem com nome correto
- Transações sem match continuam como "Sem Closer" / "Sem SDR" (comportamento esperado)

