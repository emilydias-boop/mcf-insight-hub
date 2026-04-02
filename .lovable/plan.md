

## Corrigir carregamento de métricas: usar cargo do CompPlan como fallback

### Problema
Os indicadores mostram "Organização" em vez de "Contratos Pagos" porque o hook `useActiveMetricsForSdr` busca o `cargo_catalogo_id` na tabela `employees`, mas esse SDR não tem registro de employee ativo vinculado. O resultado é que cai no fallback padrão que inclui `organizacao`.

Porém, a tabela `sdr_comp_plan` **tem** o `cargo_catalogo_id` correto (`d035345f...`). O hook precisa usar isso como fallback.

### Solução
Adicionar um fallback no `useActiveMetricsForSdr`: se não encontrar `cargo_catalogo_id` via `employees`, buscar via `sdr_comp_plan` para o mesmo SDR.

### Alteração

**`src/hooks/useActiveMetricsForSdr.ts`** (dentro do `queryFn`, após a query de employees)

Após o bloco que busca `employees.cargo_catalogo_id` (linhas 61-83), antes de retornar o fallback por falta de `cargoId`:

```text
Fluxo atual:
  employees → cargoId → fechamento_metricas_mes → métricas
  Se employees vazio → DEFAULT_SDR_METRICS (organização)

Fluxo corrigido:
  employees → cargoId
  Se vazio → sdr_comp_plan → cargo_catalogo_id
  Se vazio → sdr.cargo_catalogo_id (direto da tabela sdr)
  → fechamento_metricas_mes → métricas
  Se nada → DEFAULT_SDR_METRICS
```

Concretamente, substituir o bloco nas linhas 73-83:
```typescript
let cargoId = employeeData?.cargo_catalogo_id;

// Fallback: try sdr_comp_plan if no employee cargo
if (!cargoId) {
  const { data: compPlanData } = await supabase
    .from('sdr_comp_plan')
    .select('cargo_catalogo_id')
    .eq('sdr_id', sdrId)
    .neq('status', 'REJECTED')
    .order('vigencia_inicio', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  cargoId = compPlanData?.cargo_catalogo_id || null;
}

if (!cargoId) {
  const defaultMetrics = roleType === 'closer' ? DEFAULT_CLOSER_METRICS : DEFAULT_SDR_METRICS;
  return { metricas: defaultMetrics, fonte: 'fallback', roleType };
}
```

### Resultado esperado
O hook encontrará `cargo_catalogo_id` via `sdr_comp_plan`, buscará as métricas configuradas em `fechamento_metricas_mes`, e exibirá as 4 métricas corretas (Agendamentos 30%, Realizadas 40%, Contratos Pagos 20%, Tentativas 10%) com badge "Configurado" em vez de "Padrão".

