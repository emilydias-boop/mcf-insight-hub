

## Corrigir duplicação de leads do Make no webhook-make-a010

### Problema identificado

O `webhook-make-a010` tem falhas de deduplicação comparado ao `hubla-webhook-handler`:

| Camada | hubla-webhook-handler | webhook-make-a010 |
|--------|----------------------|-------------------|
| Busca contato por email | ✅ | ✅ |
| Busca contato por telefone (fallback) | ✅ | ❌ |
| Verificação deal existente (contact_id + origin_id) | ✅ com update | ✅ mas sem upsert |
| Upsert atômico com onConflict | ✅ | ❌ usa insert simples |
| Cross-check por telefone sufixo | ✅ | ❌ |

Resultado: se o mesmo lead chega pelo Hubla (cria contato) e depois pelo Make (não encontra por telefone, cria outro contato), aparecem 2 deals separados para a mesma pessoa.

### Solução

**Arquivo:** `supabase/functions/webhook-make-a010/index.ts` — função `createCrmDeal`

#### 1. Adicionar fallback de busca por telefone (linhas ~291-298)
Após a busca por email falhar, buscar contato por telefone normalizado (formato exato + variações com/sem +55):

```typescript
// Fallback: buscar por telefone
if (!contactId && data.phone) {
  const normalizedPhone = normalizePhone(data.phone);
  if (normalizedPhone) {
    const phoneDigits = normalizedPhone.replace(/\D/g, '');
    const phoneSuffix = phoneDigits.slice(-9);
    const { data: byPhone } = await supabase
      .from('crm_contacts')
      .select('id')
      .or(`phone.like.%${phoneSuffix}`)
      .limit(1)
      .maybeSingle();
    if (byPhone) contactId = byPhone.id;
  }
}
```

#### 2. Substituir insert por upsert atômico (linhas ~373-389)
Trocar o `insert` simples por `upsert` com `onConflict: 'contact_id,origin_id'` e `ignoreDuplicates: true`, igual ao hubla-webhook-handler:

```typescript
const { data: newDeal, error: dealError } = await supabase
  .from('crm_deals')
  .upsert(dealData, {
    onConflict: 'contact_id,origin_id',
    ignoreDuplicates: true
  })
  .select('id')
  .maybeSingle();
```

#### 3. Tratar deal existente com update de tags/valor (antes da criação)
Mover a verificação de deal existente (linha ~332) para também atualizar tags com "Make" e custom_fields, igual ao hubla-webhook-handler faz (linhas 450-478), evitando retornar "updated" sem marcar a tag.

### Resultado esperado
- Leads que chegam pelo Make e já existem por email OU telefone → atualizam o deal existente
- Race conditions entre Hubla e Make → upsert atômico previne duplicação
- Mesmo lead com variações de telefone → sufixo de 9 dígitos encontra o contato correto

### Detalhes técnicos

| Item | Detalhe |
|------|---------|
| Arquivo | `supabase/functions/webhook-make-a010/index.ts` |
| Função | `createCrmDeal` (linhas 242-424) |
| Deploy | Automático após edição |
| Impacto | Apenas novos webhooks — deals duplicados existentes precisam de merge manual via Duplicados |

