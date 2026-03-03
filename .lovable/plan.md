

## Problema

Quando "Contratos Pagos" é ativado para um SDR, o `meta_percentual` calcula a meta como **% das Realizadas** (`reunioes_realizadas`). Mas para SDRs, a lógica correta é que a meta de contratos deve ser **% dos Agendamentos** (`reunioes_agendadas`), já que o SDR agenda reuniões e uma porcentagem dessas deve converter em contrato.

Atualmente o sistema usa `reunioes_realizadas` como referência em todos os casos (lógica de Closer).

## Correção

### 1. Diferenciar referência por `cargo_base` no `DynamicIndicatorCard.tsx`

Adicionar uma prop `roleType` (ou `cargoBase`) ao componente. Quando `cargo_base === 'SDR'`:
- Usar `kpi.reunioes_agendadas` como denominador em vez de `kpi.reunioes_realizadas`
- Subtitle: `"30% de 150 agend. = 45"` em vez de `"30% de 100 realiz. = 30"`

### 2. Ajustar label na UI de configuração (`ActiveMetricsTab.tsx`)

Detectar se o cargo selecionado tem `cargo_base === 'SDR'` e mudar o label de **"% das Realiz."** para **"% das Agend."** no campo de `meta_percentual` para a métrica de contratos.

### 3. Ajustar a Edge Function (`recalculate-sdr-payout`)

Na seção que calcula `metaContratosCalculada`, verificar o `role_type` do SDR:
- Se `role_type === 'sdr'` ou `cargo_base === 'SDR'`: usar `reunioes_agendadas` 
- Se `role_type === 'closer'`: manter `reunioes_realizadas` (comportamento atual)

### 4. Ajustar `useCalculatedVariavel.ts`

Mesmo ajuste: quando o cálculo dinâmico de contratos usar `meta_percentual`, verificar o tipo do colaborador para decidir se usa agendadas ou realizadas.

### Arquivos modificados

- `src/components/fechamento/DynamicIndicatorCard.tsx` — nova prop + lógica condicional
- `src/components/fechamento/ActiveMetricsTab.tsx` — label dinâmico
- `src/hooks/useCalculatedVariavel.ts` — referência condicional
- `supabase/functions/recalculate-sdr-payout/index.ts` — cálculo server-side
- Componentes que chamam `DynamicIndicatorCard` — passar a nova prop

