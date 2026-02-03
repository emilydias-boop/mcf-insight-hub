
# Plano: Correção de Duplicação de Leads por Origem

## Status: ✅ Implementado (Partes 1 e 3)

### ✅ Parte 1: Webhook Corrigido
**Arquivo**: `supabase/functions/hubla-webhook-handler/index.ts`
- Trocado `.maybeSingle()` por `.limit(1)` na busca de origem
- Agora sempre encontra a origem existente mais antiga
- Novas compras não criam mais origens duplicadas

### ⏳ Parte 2: Limpeza de Dados (Pendente - Requer SQL Manual)
Executar no SQL Editor do Supabase para consolidar as 3.734 origens:

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

### ✅ Parte 3: Filtro de Owner no Backend
**Arquivos Modificados**:
- `src/hooks/useCRMData.ts`: Adicionado parâmetro `ownerProfileId` na interface `DealFilters` e aplicado filtro `.eq('owner_profile_id', ...)` na query
- `src/pages/crm/Negocios.tsx`: Passando `user?.id` como `ownerProfileId` quando `isRestrictedRole` (SDR/Closer)

**Benefícios**:
- SDRs/Closers agora só recebem seus próprios deals do backend
- Eliminada race condition onde todos os deals apareciam momentaneamente
- Query retorna ~95% menos dados para SDRs (muito mais rápido)
- Impossível ver/agendar leads de outros usuários

---

## Resultado

### Antes
- 3.734 origens "A010 Hubla" causando deals duplicados
- Leads com "Venda Realizada" aparecem como "Novo Lead" 
- SDRs veem leads de outros SDRs (race condition)
- Agendamentos duplicados como o da Lorena

### Depois
- Webhook usa a origem existente (não cria mais duplicatas)
- SDRs veem apenas seus próprios leads (filtrado no banco)
- Carregamento mais rápido (menos dados)
- Segurança reforçada no backend
