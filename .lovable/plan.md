

# Filtrar Cockpit SDR por BU — isolamento de pipeline

## Problema
O Cockpit SDR mostra deals de TODAS as pipelines que o SDR possui, sem filtrar pela BU do usuario. Exemplo: Carol Correa (incorporador) ve leads da pipeline "VIVER DE ALUGUEL" (consorcio) na fila.

A causa raiz e dupla:
1. As RPCs `get_sdr_cockpit_queue` e `get_sdr_cockpit_count` filtram apenas por `owner_id`, sem considerar origin/BU
2. O mapeamento `bu_origin_mapping` para incorporador mapeia apenas 1 origin direta, mas o grupo inteiro "Perpetuo - X1" (`a6f3cbfc-...`) contem todas as pipelines do incorporador (PIPELINE INSIDE SALES, LEAD GRATUITO, INSTAGRAM, SOCIOS, etc.)

## Alteracoes

### 1. Migracao SQL — Atualizar RPCs e mapeamento

**a) Adicionar grupo do incorporador ao `bu_origin_mapping`:**
```sql
INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default)
VALUES ('incorporador', 'group', 'a6f3cbfc-0567-427f-a405-5a869aaa6010', true)
ON CONFLICT DO NOTHING;
```

**b) Recriar `get_sdr_cockpit_queue` com parametro `p_origin_ids UUID[] DEFAULT NULL`:**
- Quando fornecido, adicionar `AND d.origin_id = ANY(p_origin_ids)` ao WHERE
- Quando NULL, manter comportamento atual (sem filtro de origin)

**c) Recriar `get_sdr_cockpit_count` com mesmo parametro `p_origin_ids UUID[] DEFAULT NULL`:**
- Mesma logica de filtro

### 2. `src/hooks/useSDRCockpit.ts` — Passar origin_ids para RPCs

- Importar `useActiveBU` e `useBUOriginIds`
- Em `useSDRQueueInfinite`: obter `originIds` da BU ativa, passar como `p_origin_ids` para a RPC
- Em `useSDRQueueCount`: mesma logica, passar `p_origin_ids`
- Adicionar `originIds` ao `queryKey` de ambos os hooks para invalidar cache quando BU mudar

### 3. `src/integrations/supabase/types.ts` — Atualizar tipos das RPCs

- Adicionar `p_origin_ids?: string[]` aos Args de `get_sdr_cockpit_queue` e `get_sdr_cockpit_count`

## Arquivos alterados
1. Nova migracao SQL (RPCs + mapeamento)
2. `src/hooks/useSDRCockpit.ts`
3. `src/integrations/supabase/types.ts`

## Resultado
- Carol Correa (incorporador) vera apenas leads de pipelines do grupo Perpetuo - X1: PIPELINE INSIDE SALES, LEAD GRATUITO, INSTAGRAM, etc.
- Leads de "VIVER DE ALUGUEL" continuam visiveis apenas se essa origin tambem estiver mapeada para incorporador (atualmente nao esta — pertence ao mesmo grupo mas o mapeamento pode ser ajustado no admin de configuracao BU)
- Nenhuma outra tela afetada

