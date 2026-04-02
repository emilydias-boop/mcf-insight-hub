

## Diagnóstico: Percentual de Contratos por Nível de Closer

### O que existe no sistema

O campo `meta_percentual` na tabela `fechamento_metricas_mes` **já suporta** percentuais diferentes por cargo/nível. O código já usa esse campo (linha 104-108 do `DynamicIndicatorCard.tsx`):
- Se `meta_percentual > 0` → usa esse valor
- Senão, fallback hardcoded de 30%

### Dados no banco

Métricas **genéricas** (squad=null) estão configuradas corretamente:
- Closer N1 (`c2909e20`): `meta_percentual = 30` 
- Closer N2 (`fd8d5a86`): `meta_percentual = 35`
- Closer N3 (`d7bdc06e`): **nenhuma métrica configurada**

Métricas **squad=incorporador**: todas têm `meta_percentual = NULL` para contratos

### Problemas encontrados

**Problema 1 — Thayna (N2):**
A tabela `employees` vincula Thayna ao cargo **Closer N3** (`d7bdc06e`), mas o `sdr_comp_plan` dela diz **Closer N2** (`fd8d5a86`). Como N3 não tem métricas configuradas em `fechamento_metricas_mes`, ela cai no fallback padrão com 30% hardcoded. **Isso é um problema de dados** — o cargo no `employees` está errado ou falta configurar métricas para N3.

**Problema 2 — Fallback de squad ignora nível:**
Quando existem métricas squad-specific (squad=incorporador) com `meta_percentual = NULL`, o código busca o valor da métrica genérica (squad=null) como fallback. Isso funciona para Cris (N1), mas se a métrica genérica não existir para o cargo, cai no 30% hardcoded.

### Solução proposta

1. **Remover o fallback hardcoded de 30%** no `DynamicIndicatorCard.tsx` (linhas 109-113) e no `useCalculatedVariavel.ts`
   - Em vez de `0.3` fixo, usar o `nivel` do cargo para determinar o percentual: N1=30%, N2=35%, N3=40%
   - Ou melhor: buscar o `meta_percentual` da métrica genérica quando a squad-specific não tem

2. **Melhorar o fallback no `useActiveMetricsForSdr.ts`** (linhas 127-144)
   - Atualmente só faz fallback de `meta_percentual` para a métrica `contratos`
   - Generalizar: para QUALQUER métrica squad-specific com `meta_percentual = NULL`, buscar da genérica

3. **Corrigir a resolução de cargo** — se `employees.cargo_catalogo_id` divergir de `sdr_comp_plan.cargo_catalogo_id`, preferir o mais recente do `sdr_comp_plan` (já que esse reflete o nível atual do closer)

### Alterações

1. **`src/hooks/useActiveMetricsForSdr.ts`**
   - Na resolução de `cargoId`: preferir `sdr_comp_plan` sobre `employees` (é mais atualizado para closers)
   - No fallback squad→genérica: aplicar `meta_percentual` de qualquer métrica genérica, não só `contratos`

2. **`src/components/fechamento/DynamicIndicatorCard.tsx`** (linhas 109-113)
   - Remover o fallback hardcoded `0.3` / `30%` — se `meta_percentual` não estiver na métrica, usar 30% como último recurso mas com log de aviso

3. **`src/hooks/useCalculatedVariavel.ts`**
   - Mesma remoção do hardcoded 30% — usar `metrica.meta_percentual` ou fallback 30%

4. **`supabase/functions/recalculate-sdr-payout/index.ts`**
   - Mesma lógica: buscar `meta_percentual` da métrica configurada em vez de hardcoded

### Resultado esperado
- Cris (N1): Meta de contratos = 30% das realizadas (sem mudança visual)
- Thayna (N2): Meta de contratos = 35% das realizadas (corrigido)
- Futuro N3: Meta de contratos = 40% das realizadas

