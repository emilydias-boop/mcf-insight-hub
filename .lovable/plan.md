
# Plano: Correção de Duplicação de Leads por Origem

## Diagnóstico Confirmado

### Causa Raiz: 3.734 Origens Duplicadas "A010 Hubla"

O webhook `hubla-webhook-handler` está criando uma nova origem a cada chamada porque:

1. A busca usa `.maybeSingle()` que retorna `null` quando há **múltiplas correspondências**
2. O código interpreta `null` como "não existe" e cria uma NOVA origem
3. Como o `upsert` usa `onConflict(contact_id, origin_id)`, cada nova origin_id permite criar um novo deal

### Impacto Atual
- **3.734 origens** chamadas "A010 Hubla" criadas desde 14/12/2025
- Leads duplicados aparecendo como "Novo Lead" mesmo tendo "Venda Realizada" em outro deal
- SDRs diferentes veem e agendam o mesmo lead
- Métricas de conversão incorretas

---

## Solução em 3 Partes

### Parte 1: Corrigir o Webhook (Prevenção)

**Arquivo**: `supabase/functions/hubla-webhook-handler/index.ts`

Trocar `.maybeSingle()` por `.limit(1).single()` na busca de origem:

```typescript
// ANTES (problemático):
const { data: existingOrigin } = await supabase
  .from('crm_origins')
  .select('id')
  .ilike('name', data.originName)
  .maybeSingle();  // Retorna null se houver múltiplas!

// DEPOIS (correto):
const { data: existingOrigin } = await supabase
  .from('crm_origins')
  .select('id')
  .ilike('name', data.originName)
  .order('created_at', { ascending: true })
  .limit(1);

if (existingOrigin && existingOrigin.length > 0) {
  originId = existingOrigin[0].id;
}
```

### Parte 2: Limpar Origens Duplicadas (Dados)

Executar SQL para consolidar as 3.734 origens em UMA:

```sql
-- 1. Identificar a origem mais antiga (canonical)
WITH canonical AS (
  SELECT id 
  FROM crm_origins 
  WHERE name ILIKE '%A010 Hubla%' 
  ORDER BY created_at ASC 
  LIMIT 1
)
-- 2. Atualizar todos os deals para usar a origem canônica
UPDATE crm_deals 
SET origin_id = (SELECT id FROM canonical)
WHERE origin_id IN (
  SELECT id FROM crm_origins WHERE name ILIKE '%A010 Hubla%'
);

-- 3. Atualizar contatos também
UPDATE crm_contacts 
SET origin_id = (SELECT id FROM canonical)
WHERE origin_id IN (
  SELECT id FROM crm_origins WHERE name ILIKE '%A010 Hubla%'
);

-- 4. Remover origens duplicadas (manter apenas a canônica)
DELETE FROM crm_origins 
WHERE name ILIKE '%A010 Hubla%' 
AND id != (
  SELECT id FROM crm_origins 
  WHERE name ILIKE '%A010 Hubla%' 
  ORDER BY created_at ASC 
  LIMIT 1
);
```

### Parte 3: Filtrar Leads por Owner no Backend

Implementar o filtro de `owner_profile_id` no backend para garantir que SDRs vejam apenas seus próprios leads:

**Arquivo**: `src/hooks/useCRMData.ts`

```typescript
interface DealFilters {
  // ... filtros existentes
  ownerProfileId?: string; // NOVO
}

export const useCRMDeals = (filters: DealFilters = {}) => {
  // ...
  queryFn: async () => {
    let query = supabase.from('crm_deals').select(...);
    
    // Filtro de owner no BACKEND
    if (filters.ownerProfileId) {
      query = query.eq('owner_profile_id', filters.ownerProfileId);
    }
    // ...
  }
};
```

**Arquivo**: `src/pages/crm/Negocios.tsx`

```typescript
const { data: dealsData } = useCRMDeals({
  originId: effectiveOriginId,
  // Se for SDR/Closer, filtrar no backend
  ownerProfileId: isRestrictedRole ? user?.id : undefined,
});
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/hubla-webhook-handler/index.ts` | Modificar | Corrigir busca de origem com `.limit(1)` |
| `src/hooks/useCRMData.ts` | Modificar | Adicionar filtro `ownerProfileId` na query |
| `src/pages/crm/Negocios.tsx` | Modificar | Passar `user?.id` como `ownerProfileId` para SDRs |
| SQL Migration | Executar | Consolidar origens e limpar duplicatas |

---

## Ordem de Execução

1. **Primeiro**: Corrigir o webhook para parar de criar novas origens
2. **Segundo**: Executar SQL para consolidar origens duplicadas
3. **Terceiro**: Implementar filtro de owner no backend
4. **Quarto**: Limpar deals duplicados manualmente (se necessário)

---

## Resultado Esperado

### Antes
- 3.734 origens "A010 Hubla" causando deals duplicados
- Leads com "Venda Realizada" aparecem como "Novo Lead" 
- SDRs veem leads de outros SDRs
- Agendamentos duplicados como o da Lorena

### Depois
- UMA origem "A010 Hubla" (a mais antiga)
- Novos webhooks usam a origem existente
- Upsert funciona corretamente, impedindo duplicatas
- SDRs veem apenas seus próprios leads
- Impossível agendar lead de outro SDR
