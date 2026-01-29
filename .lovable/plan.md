

# Plano: Corrigir Webhook de Leads LIVE

## Problema Identificado

O webhook `webhook-live-leads` está **falhando** porque tenta inserir dados na coluna `data_source` da tabela `crm_contacts`, mas essa coluna **não existe** nessa tabela.

```
ERRO: Could not find the 'data_source' column of 'crm_contacts' in the schema cache
```

**Resultado:** Nenhum lead de LIVE foi recebido corretamente.

---

## Causa Raiz

No arquivo `supabase/functions/webhook-live-leads/index.ts`, linha 73:

```typescript
// PROBLEMA: crm_contacts NÃO tem coluna data_source
.insert({
  clint_id: `live-${Date.now()}...`,
  name: payload.name,
  email: payload.email,
  phone: normalizedPhone,
  origin_id: LIVE_ORIGIN_ID,
  tags: ['Lead-Live'],
  data_source: 'webhook-live'  // ❌ COLUNA NÃO EXISTE!
})
```

---

## Solução

### Alteração no Arquivo

**`supabase/functions/webhook-live-leads/index.ts`**

#### 1. Remover `data_source` do insert de `crm_contacts` (linhas 64-76)

Antes:
```typescript
const { data: newContact, error: contactError } = await supabase
  .from('crm_contacts')
  .insert({
    clint_id: `live-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name: payload.name,
    email: payload.email.trim().toLowerCase(),
    phone: normalizedPhone,
    origin_id: LIVE_ORIGIN_ID,
    tags: ['Lead-Live'],
    data_source: 'webhook-live'  // ❌ REMOVER
  })
```

Depois:
```typescript
const { data: newContact, error: contactError } = await supabase
  .from('crm_contacts')
  .insert({
    clint_id: `live-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name: payload.name,
    email: payload.email.trim().toLowerCase(),
    phone: normalizedPhone,
    origin_id: LIVE_ORIGIN_ID,
    tags: ['Lead-Live']
    // data_source fica apenas no crm_deals ✓
  })
```

A informação `data_source: 'webhook-live'` já está corretamente no insert de `crm_deals` (linha 149), que **tem** essa coluna.

---

## Verificação Pós-Correção

Após a correção, testaremos o webhook para confirmar que funciona:

1. Enviar POST de teste para o webhook
2. Verificar que o contato é criado com tag `Lead-Live`
3. Verificar que o deal é criado com `data_source: 'webhook-live'`
4. Confirmar que o lead aparece no Kanban

---

## Próximo Passo: Configurar no Clint

Após corrigir o webhook, o formulário da LIVE no Clint precisa enviar para:

```
https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/webhook-live-leads
```

Com payload no formato:
```json
{
  "name": "Nome do Lead",
  "email": "email@exemplo.com",
  "whatsapp": "11999998888",
  "objective": "Construir para vender",
  "profileType": "Investidor",
  "monthlyIncome": "R$ 10 mil a R$ 20 mil"
}
```

---

## Resumo das Mudanças

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `webhook-live-leads/index.ts` | 73 | Remover `data_source: 'webhook-live'` do insert de contatos |

