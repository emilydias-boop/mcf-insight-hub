

# Restringir Antony para ver apenas PILOTO ANAMNESE / INDICAÇÃO

## Problema

O Antony (SDR, BU incorporador) precisa ver **apenas** a pipeline "PILOTO ANAMNESE / INDICAÇÃO" e **não** a "Inside Sales". Atualmente, SDRs do incorporador são fixados na Inside Sales sem opção de troca.

## Solução

Adicionar uma coluna `allowed_origin_ids` (TEXT[]) na tabela `sdr` para override individual de pipelines. Quando preenchida, o SDR vê **apenas** essas pipelines em vez do padrão da BU.

### 1. Migration: adicionar coluna na tabela `sdr`

```sql
ALTER TABLE public.sdr ADD COLUMN allowed_origin_ids TEXT[] DEFAULT NULL;

-- Configurar Antony para ver apenas PILOTO ANAMNESE
UPDATE public.sdr 
SET allowed_origin_ids = ARRAY['7431cf4a-dc29-4208-95a6-28a499a06dac']
WHERE id = '11111111-0001-0001-0001-000000000005';
```

### 2. Hook para buscar override do SDR

Criar `src/hooks/useSDROriginOverride.ts` — busca `allowed_origin_ids` do SDR logado. Se preenchido, retorna esses IDs; se null, retorna null (usa padrão da BU).

### 3. Alterar `Negocios.tsx`

No cálculo de `effectiveOriginId` e no `useEffect` de auto-seleção:
- Se SDR tem `allowed_origin_ids`, usar o primeiro como default e restringir sidebar/dropdown a essas origens
- Se não tem override, manter comportamento atual (padrão da BU)

No `showSidebar`: se SDR tem override com 1 pipeline, esconder sidebar (single pipeline). Se tem múltiplas no override, mostrar sidebar.

| Arquivo | Alteração |
|---|---|
| Migration SQL | Adicionar `allowed_origin_ids TEXT[]` na tabela `sdr` + setar Antony |
| `src/hooks/useSDROriginOverride.ts` | Novo hook para buscar override |
| `src/pages/crm/Negocios.tsx` | Usar override quando disponível no effectiveOriginId e sidebar |

### Resultado

- Antony verá **apenas** PILOTO ANAMNESE / INDICAÇÃO (sem sidebar, pipeline fixa)
- Outros SDRs do incorporador continuam vendo Inside Sales normalmente
- Futuramente, basta editar `allowed_origin_ids` no admin/RH para mudar a pipeline de qualquer SDR

