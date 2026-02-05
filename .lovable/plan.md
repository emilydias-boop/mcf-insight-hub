
# Plano: Corrigir Criação de Novo Negócio via DealFormDialog

## Problema Identificado

O erro ao criar novo negócio é:
```
null value in column "clint_id" of relation "crm_deals" violates not-null constraint
```

**Causa raiz**: O campo `clint_id` é obrigatório (`NOT NULL`) na tabela `crm_deals`, mas o `DealFormDialog` não inclui esse campo no payload ao criar o deal.

| Campo | Requerido | Payload Atual |
|-------|-----------|---------------|
| `clint_id` | ✅ NOT NULL | ❌ Não incluído |
| `data_source` | ✅ default='csv' | ❌ Não incluído |
| `name` | ✅ | ✅ Incluído |
| `value` | ✅ | ✅ Incluído |
| `stage_id` | ✅ | ✅ Incluído |
| `contact_id` | ✅ | ✅ Incluído |
| `origin_id` | ✅ | ✅ Incluído |

## Solução

Adicionar `clint_id` e `data_source` ao payload de criação do deal no `DealFormDialog.tsx`:

```typescript
const payload = {
  name: data.name,
  value: data.value,
  stage_id: data.stage,
  contact_id: newContact.id,
  origin_id: defaultOriginId,
  owner_id: selectedProfile?.email || undefined,
  owner_profile_id: data.owner_id || undefined,
  clint_id: `local-${Date.now()}`,  // ← ADICIONAR
  data_source: 'manual',             // ← ADICIONAR (indica criação manual)
};
```

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/DealFormDialog.tsx` | Adicionar `clint_id` e `data_source` ao payload (linhas 165-173) |

## Detalhes Técnicos

- **`clint_id`**: Usa formato `local-{timestamp}` para indicar que é um deal criado localmente (não sincronizado do Clint CRM externo)
- **`data_source`**: Marca como `'manual'` para diferenciar de leads vindos de webhook, CSV ou Clint sync
