
# Plano: Corrigir Transferência em Massa para Atualizar owner_profile_id

## Problema Identificado

A transferência em massa de leads do Vinicius para o Alex atualizou apenas o campo `owner_id` (email), mas **não atualizou o campo `owner_profile_id`** (UUID).

**Evidência no banco de dados:**

| Campo | Valor Atual | Valor Correto |
|-------|-------------|---------------|
| `owner_id` | `alex.dias@minhacasafinanciada.com` | ✅ Correto |
| `owner_profile_id` | `992a3790-...` (UUID do Vinicius) | `16c5d025-...` (UUID do Alex) |

Como o filtro de responsáveis foi corrigido para usar `owner_profile_id`, os leads transferidos não aparecem na pipeline do Alex.

## Causa Raiz

No arquivo `src/hooks/useBulkTransfer.ts`, linha 40:

```typescript
const { error: updateError } = await supabase
  .from('crm_deals')
  .update({ owner_id: newOwnerEmail })  // ❌ Falta owner_profile_id
  .eq('id', dealId);
```

O update só atualiza `owner_id` mas ignora `owner_profile_id`.

---

## Solução

### Mudança 1: Passar o UUID do novo owner na transferência

No `BulkTransferDialog.tsx`:
- Já temos acesso ao `user.id` (UUID) quando selecionamos o usuário
- Passar esse ID para o `useBulkTransfer`

### Mudança 2: Atualizar ambos os campos no banco

No `useBulkTransfer.ts`:
- Receber o `newOwnerProfileId` como parâmetro
- Atualizar tanto `owner_id` quanto `owner_profile_id`

### Mudança 3: Corrigir dados históricos

Executar um update para os leads que já foram transferidos mas ficaram com `owner_profile_id` inconsistente.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useBulkTransfer.ts` | Adicionar `newOwnerProfileId` ao update |
| `src/components/crm/BulkTransferDialog.tsx` | Passar `user.id` como parâmetro |

---

## Detalhes Técnicos

### useBulkTransfer.ts

```typescript
interface BulkTransferParams {
  dealIds: string[];
  newOwnerEmail: string;
  newOwnerName: string;
  newOwnerProfileId: string;  // ← ADICIONAR
}

// No update:
const { error: updateError } = await supabase
  .from('crm_deals')
  .update({ 
    owner_id: newOwnerEmail,
    owner_profile_id: newOwnerProfileId  // ← ADICIONAR
  })
  .eq('id', dealId);
```

### BulkTransferDialog.tsx

```typescript
await bulkTransfer.mutateAsync({
  dealIds: selectedDealIds,
  newOwnerEmail: user.email,
  newOwnerName: user.full_name || user.email,
  newOwnerProfileId: user.id,  // ← ADICIONAR (já temos esse dado!)
});
```

---

## Correção de Dados Históricos

Após aplicar a correção, precisaremos executar um SQL para corrigir os leads já transferidos:

```sql
-- Atualizar owner_profile_id baseado no owner_id (email)
UPDATE crm_deals d
SET owner_profile_id = p.id
FROM profiles p
WHERE d.owner_id = p.email
  AND d.owner_profile_id IS DISTINCT FROM p.id;
```

Este SQL será fornecido para execução manual no Cloud View.

---

## Resultado Esperado

1. Transferências futuras atualizarão ambos os campos corretamente
2. O filtro por responsável funcionará imediatamente após a transferência
3. Os leads do Alex aparecerão na pipeline dele
