
# Plano: Corrigir Sincronização de `owner_profile_id` no Webhook Clint

## Diagnóstico

**Problema Identificado:** Os leads estão entrando no sistema via `clint-webhook-handler`, mas o campo `owner_profile_id` não está sendo preenchido. O CRM usa este campo (UUID) para filtrar leads por SDR - sem ele, os SDRs não conseguem ver seus leads atribuídos.

**Dados do Problema:**
- **70 leads** nas últimas 7 dias com `owner_profile_id = NULL`
- Todos são da pipeline **PIPELINE INSIDE SALES** (origin_id: `e3c04f21-ba2c-4c66-84f8-b4341c826b1c`)
- Os leads **têm** `owner_id` (email) preenchido corretamente
- Os profiles dos SDRs **existem** no banco de dados

**Causa Raiz:** A função `handleDealCreated` no `clint-webhook-handler` define apenas `owner_id` (linha 644) mas **não busca e sincroniza** o `owner_profile_id` correspondente.

---

## Solução

### 1. Atualizar `handleDealCreated` no `clint-webhook-handler`

Adicionar lógica de lookup do profile após definir o owner:

```text
Arquivo: supabase/functions/clint-webhook-handler/index.ts
Local: Após linha 608 (onde define ownerId)
```

**Alteração:**
```typescript
// 4. Owner (usuário responsável)
const ownerId = ownerName || null;
console.log('[DEAL.CREATED] Owner (email):', ownerId);

// 4.1 NOVO: Buscar owner_profile_id correspondente
let ownerProfileId: string | null = null;
if (ownerId) {
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', ownerId)
    .maybeSingle();
  
  if (ownerProfile) {
    ownerProfileId = ownerProfile.id;
    console.log('[DEAL.CREATED] Profile ID encontrado:', ownerProfileId);
  } else {
    console.log('[DEAL.CREATED] ⚠️ Profile não encontrado para:', ownerId);
  }
}
```

E no upsert do deal (linha 644), adicionar:
```typescript
owner_id: ownerId,
owner_profile_id: ownerProfileId, // NOVO
```

### 2. Backfill dos Leads Existentes

Executar SQL para corrigir os 70 leads que já estão com `owner_profile_id = NULL`:

```sql
UPDATE crm_deals d
SET owner_profile_id = p.id
FROM profiles p
WHERE d.owner_id = p.email
  AND d.owner_profile_id IS NULL
  AND d.owner_id IS NOT NULL;
```

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/clint-webhook-handler/index.ts` | Adicionar lookup de `owner_profile_id` em `handleDealCreated` |

---

## Resultado Esperado

Após implementação:
1. **Novos leads** via Clint terão `owner_profile_id` preenchido automaticamente
2. **Leads existentes** serão corrigidos via backfill SQL
3. **SDRs verão seus leads** corretamente no Kanban do CRM

---

## Seção Técnica

### Fluxo de Filtragem do CRM

O hook `useCRMData` aplica filtro de backend usando `owner_profile_id`:
```typescript
if (filters.ownerProfileId) {
  query = query.eq('owner_profile_id', filters.ownerProfileId);
}
```

Para SDRs/Closers, esse filtro é sempre ativo. Leads sem `owner_profile_id` ficam invisíveis.

### Comparação dos Webhooks

| Webhook | Lookup de Profile | Status |
|---------|------------------|--------|
| `webhook-lead-receiver` | Sim (linhas 266-278) | OK |
| `webhook-live-leads` | Sim | OK |
| `hubla-webhook-handler` | Sim (linhas 461-472) | OK |
| `clint-webhook-handler` | **NÃO** | **PROBLEMA** |

### Validação Pós-Implementação

Query para verificar sucesso:
```sql
SELECT COUNT(*) as pendentes
FROM crm_deals 
WHERE owner_profile_id IS NULL 
  AND owner_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days';
```

Resultado esperado: `0`
