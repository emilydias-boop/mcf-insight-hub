
# Plano de Correção: Meta % Contratos e Cálculo de Variável para Closers

## Problemas Identificados

| Problema | Causa | Evidência |
|----------|-------|-----------|
| Meta mostrando 20 ao invés de 69 | Métricas configuradas sem BU (`squad=null`) têm `meta_percentual=30`, mas Edge Function busca métricas com `squad='incorporador'` que têm `meta_percentual=null` | Query retornou 2 registros de contratos para Closer Inside N1: um com squad=null e meta_percentual=30, outro com squad=incorporador e meta_percentual=null |
| Contratos = 0 na Edge Function | A lógica de busca de contratos na Edge Function está filtrando por attendees de slots com `scheduled_at` no período, mas a contagem correta usa `contract_paid_at` | Log: `Contratos=0`, Frontend: 89 |
| Variável = R$ 315 ao invés de ~R$ 1.785 | Sem contratos e sem meta%, o cálculo só considera organização (15% × R$ 2.100 = R$ 315) | Log: `valor_variavel: "315.00"` |
| iFood Ultrameta = R$ 0 | pctContratos = 0%, regra exige >= 100% | Lógica correta, porém dependente do fix de contratos |

## Correções Técnicas

### 1. Corrigir Lógica de Busca de Métricas na Edge Function

**Problema**: A Edge Function prioriza métricas com `squad` específico, mas a configuração com `meta_percentual=30` está salva com `squad=null`.

**Solução**: Quando buscar métricas com squad específico, verificar se `meta_percentual` está preenchido. Se não estiver, usar fallback de métricas genéricas (squad=null).

```typescript
// Na Edge Function, após buscar métricas específicas do squad:
if (metricasSquad && metricasSquad.length > 0) {
  // Verificar se as métricas têm meta_percentual para contratos
  const metricaContratosSquad = metricasSquad.find(m => m.nome_metrica === 'contratos');
  
  // Se não tiver meta_percentual, buscar fallback genérico
  if (!metricaContratosSquad?.meta_percentual) {
    const { data: metricasGenericas } = await supabase
      .from('fechamento_metricas_mes')
      .select('nome_metrica, peso_percentual, meta_valor, meta_percentual, fonte_dados')
      .eq('ano_mes', ano_mes)
      .eq('cargo_catalogo_id', employeeData.cargo_catalogo_id)
      .is('squad', null)
      .eq('ativo', true);
    
    if (metricasGenericas) {
      // Mesclar: usar peso do squad mas meta_percentual do genérico
      const metricaContratosGenerica = metricasGenericas.find(m => m.nome_metrica === 'contratos');
      if (metricaContratosGenerica?.meta_percentual) {
        metricasSquad = metricasSquad.map(m => 
          m.nome_metrica === 'contratos' 
            ? { ...m, meta_percentual: metricaContratosGenerica.meta_percentual }
            : m
        );
      }
    }
  }
  metricas = metricasSquad;
}
```

### 2. Corrigir Contagem de Contratos Pagos na Edge Function

**Problema**: A Edge Function conta contratos de forma diferente do hook `useCloserAgendaMetrics`.

**Solução**: Alinhar a lógica da Edge Function com o hook, usando `contract_paid_at` no período + fallback para registros antigos.

```typescript
// Buscar contratos pagos pela DATA DO PAGAMENTO (igual ao hook useCloserAgendaMetrics)
const { data: contractsByPaymentDate } = await supabase
  .from('meeting_slot_attendees')
  .select('id, status, contract_paid_at, meeting_slot:meeting_slots!inner(closer_id)')
  .eq('meeting_slot.closer_id', closerRecord.id)
  .in('status', ['contract_paid', 'refunded'])
  .not('contract_paid_at', 'is', null)
  .gte('contract_paid_at', `${monthStart}T00:00:00`)
  .lte('contract_paid_at', `${monthEnd}T23:59:59`);

// Fallback para contratos antigos sem contract_paid_at
const { data: contractsLegacy } = await supabase
  .from('meeting_slot_attendees')
  .select('id, status, meeting_slot:meeting_slots!inner(closer_id, scheduled_at)')
  .eq('meeting_slot.closer_id', closerRecord.id)
  .in('status', ['contract_paid', 'refunded'])
  .is('contract_paid_at', null)
  .gte('meeting_slot.scheduled_at', `${monthStart}T00:00:00`)
  .lte('meeting_slot.scheduled_at', `${monthEnd}T23:59:59`);

contratosPagos = (contractsByPaymentDate?.length || 0) + (contractsLegacy?.length || 0);
```

### 3. Adicionar Campo Editável para iFood Ultrameta

**Problema**: Usuário precisa configurar o valor do iFood Ultrameta.

**Solução**: 
- Usar o campo existente `ifood_ultrameta` do `sdr_comp_plan` (já existe)
- Quando não houver comp_plan, usar o valor do calendário (`working_days_calendar.ifood_ultrameta`)
- Adicionar campo na UI de configuração se necessário

### 4. Atualizar Hook useActiveMetricsForSdr

**Problema**: Mesmo no frontend, se existir métrica com squad mas sem `meta_percentual`, deveria usar fallback.

**Solução**: Aplicar mesma lógica de mescla no hook.

```typescript
// Se encontrou métricas com squad mas sem meta_percentual para contratos,
// buscar da versão genérica e mesclar
if (metricas.length > 0) {
  const contratosMetrica = metricas.find(m => m.nome_metrica === 'contratos');
  if (contratosMetrica && !contratosMetrica.meta_percentual) {
    // Buscar versão genérica para pegar meta_percentual
    const { data: genericMetrics } = await supabase
      .from('fechamento_metricas_mes')
      .select('*')
      .eq('ano_mes', anoMes)
      .eq('cargo_catalogo_id', cargoId)
      .is('squad', null)
      .eq('ativo', true);
    
    if (genericMetrics) {
      const genericContratos = genericMetrics.find(m => m.nome_metrica === 'contratos');
      if (genericContratos?.meta_percentual) {
        metricas = metricas.map(m => 
          m.nome_metrica === 'contratos' 
            ? { ...m, meta_percentual: genericContratos.meta_percentual }
            : m
        );
      }
    }
  }
}
```

## Fluxo de Cálculo Corrigido para Julio

```text
Entrada:
├─ Realizadas: 230 (do KPI)
├─ Contratos Pagos: 89 (da Agenda, pela data de pagamento)
├─ Organização: 100% (manual)
├─ Variável Total: R$ 2.100 (cargo_catalogo)
└─ Métricas: contratos(50%, meta_percentual=30), organizacao(50%)

Cálculo Contratos:
├─ Meta: 30% × 230 = 69
├─ Realizado: 89
├─ %: 89/69 = 129%
├─ Multiplicador: 1x (100-119%) → ERRADO! 129% = 1.5x
├─ Valor Base: R$ 2.100 × 50% = R$ 1.050
└─ Valor Final: R$ 1.050 × 1.5 = R$ 1.575

Cálculo Organização:
├─ Meta: 100%
├─ Realizado: 100%
├─ %: 100%
├─ Multiplicador: 1x
├─ Valor Base: R$ 2.100 × 50% = R$ 1.050
└─ Valor Final: R$ 1.050 × 1 = R$ 1.050

Resultado:
├─ Variável Total: R$ 1.575 + R$ 1.050 = R$ 2.625
├─ Fixo: R$ 4.900
├─ Total Conta: R$ 7.525
├─ iFood Mensal: R$ 600
├─ iFood Ultrameta: R$ 50 (se pctContratos >= 100%)
└─ Total: R$ 8.175
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/recalculate-sdr-payout/index.ts` | Corrigir busca de métricas com fallback para meta_percentual, corrigir contagem de contratos pagos |
| `src/hooks/useActiveMetricsForSdr.ts` | Adicionar fallback para meta_percentual de métricas genéricas |

## Opção Alternativa (mais simples)

Se preferir, você pode simplesmente **deletar** as métricas duplicadas com `squad=incorporador` e manter apenas as genéricas (`squad=null`). Assim:

1. Ir em Configurações > Métricas Ativas
2. Selecionar "Closer Inside N1" e BU "Incorporador"
3. Desativar todas as métricas
4. Selecionar "Closer Inside N1" e BU "Todas"
5. Configurar: Contratos 50% Meta% 30, Organização 50%
6. Salvar

Isso fará com que todos os Closers Inside N1 (independente de BU) usem a mesma configuração.

## Ordem de Implementação

1. Corrigir contagem de contratos pagos na Edge Function
2. Corrigir fallback de meta_percentual na Edge Function
3. Corrigir fallback de meta_percentual no hook useActiveMetricsForSdr
4. Testar recálculo do Julio
