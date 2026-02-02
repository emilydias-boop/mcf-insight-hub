
# Plano: Corrigir Webhook "efeito-alavanca-clube"

## Diagnóstico Confirmado

### Erro Principal
O webhook está falhando com:
```
Could not find the 'data_source' column of 'crm_contacts' in the schema cache
```

### Causa Raiz
O código da Edge Function `webhook-lead-receiver` (linha 153) tenta inserir:
```typescript
.insert({
  // ...
  data_source: 'webhook'  // ❌ Esta coluna NÃO existe em crm_contacts
})
```

Verificação do schema:
| Tabela | Coluna `data_source` |
|--------|---------------------|
| `crm_contacts` | ❌ Não existe |
| `crm_deals` | ✅ Existe |

### Problema Secundário
O webhook busca a etapa inicial em `crm_stages` (linha 99-108), mas as etapas de "Efeito Alavanca + Clube" estão em `local_pipeline_stages`.

---

## Solução

### 1) Remover `data_source` do insert de contatos
A coluna `data_source` existe apenas em `crm_deals`, não em `crm_contacts`.

**Arquivo:** `supabase/functions/webhook-lead-receiver/index.ts`

Alterar linhas 142-156:
```typescript
// Antes (com erro)
.insert({
  clint_id: `${slug}-${Date.now()}-...`,
  name: payload.name,
  email: ...,
  phone: normalizedPhone,
  origin_id: endpoint.origin_id,
  tags: autoTags,
  data_source: 'webhook'  // ❌ REMOVER
})

// Depois (corrigido)
.insert({
  clint_id: `${slug}-${Date.now()}-...`,
  name: payload.name,
  email: ...,
  phone: normalizedPhone,
  origin_id: endpoint.origin_id,
  tags: autoTags
  // data_source removido - só existe em crm_deals
})
```

### 2) Buscar etapa inicial em `local_pipeline_stages` primeiro
Alterar a lógica de fallback de stage (linhas 97-108):

```typescript
// Antes: busca apenas em crm_stages
if (!stageId) {
  const { data: firstStage } = await supabase
    .from('crm_stages')
    .select('id')
    .eq('origin_id', endpoint.origin_id)
    .order('order_index', { ascending: true })
    .limit(1)
    .maybeSingle();
  stageId = firstStage?.id || null;
}

// Depois: busca primeiro em local_pipeline_stages, depois em crm_stages
if (!stageId) {
  // Tentar local_pipeline_stages primeiro (novas pipelines)
  const { data: localStage } = await supabase
    .from('local_pipeline_stages')
    .select('id')
    .eq('origin_id', endpoint.origin_id)
    .eq('is_active', true)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();
  
  if (localStage) {
    stageId = localStage.id;
    console.log('[WEBHOOK-RECEIVER] Usando etapa de local_pipeline_stages:', stageId);
  } else {
    // Fallback para crm_stages (pipelines legadas)
    const { data: legacyStage } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('origin_id', endpoint.origin_id)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle();
    stageId = legacyStage?.id || null;
  }
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/webhook-lead-receiver/index.ts` | Remover `data_source` do insert de contatos (linha 153) e buscar stage em `local_pipeline_stages` primeiro (linhas 97-108) |

---

## Resultado Esperado

1. O webhook deixará de retornar erro 500
2. Leads enviados para `/webhook-lead-receiver/efeito-alavanca-clube` serão criados corretamente
3. Os deals serão atribuídos à primeira etapa configurada em `local_pipeline_stages` (ex: "NOVO LEAD (FORM)")
4. O contador `leads_received` do endpoint será incrementado

---

## Teste de Validação
Após a correção, faremos um POST de teste:
```bash
POST /webhook-lead-receiver/efeito-alavanca-clube
{
  "name": "Teste Webhook",
  "email": "teste@exemplo.com",
  "phone": "11999999999"
}
```

Resposta esperada:
```json
{
  "success": true,
  "action": "created",
  "deal_id": "...",
  "contact_id": "...",
  "endpoint": "Efeito Alavanca + Clube"
}
```
