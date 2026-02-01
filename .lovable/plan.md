
# Integração: Métricas Reais no Ranking de Premiações

## Problema Atual

O ranking de premiações está usando **valores aleatórios simulados** (`Math.random()`) ao invés de buscar os dados reais do sistema de fechamento.

```typescript
// RankingLeaderboard.tsx linha 108
valor: Math.floor(Math.random() * 100), // TODO: Usar dados reais
```

---

## Fonte de Dados Disponível

Os dados reais estão na tabela `sdr_month_payout` (Jan/2026):

| Colaborador | total_conta | pct_agendadas |
|-------------|-------------|---------------|
| Jessica Martins | R$ 5.040 | 83.5% |
| Carol Correa | R$ 3.570 | 96.7% |
| Cristiane Gomes | R$ 3.400 | 215% |
| Antony Elias | R$ 3.360 | 90% |

Para calcular **OTE %**:
```
OTE % = (total_conta / ote_total) × 100
```

---

## Mapeamento Métrica → Campo

| Métrica Selecionada | Fonte | Campo |
|---------------------|-------|-------|
| `agendamentos` | sdr_month_kpi | reunioes_agendadas |
| `realizadas` | sdr_month_kpi | reunioes_realizadas |
| `contratos` | Agenda/Hubla | contract_paid count |
| `tentativas` | sdr_month_kpi | tentativas_ligacoes |
| `no_show_inverso` | sdr_month_payout | pct_no_show (inverter) |
| `taxa_conversao` | Calculado | contratos/realizadas × 100 |
| `ote_pct` | sdr_month_payout + sdr_comp_plan | total_conta/ote_total × 100 |

---

## Solução Proposta

### Arquivo: `src/components/premiacoes/RankingLeaderboard.tsx`

### Passo 1: Criar função para buscar métricas por período

```typescript
const getAnoMesFromPeriodo = (dataInicio: string, dataFim: string): string[] => {
  // Retorna array de ano_mes no formato "2026-01"
  // Para período 01/01 a 31/01 → ["2026-01"]
  // Para período 01/01 a 28/02 → ["2026-01", "2026-02"]
};
```

### Passo 2: Buscar payouts dos colaboradores elegíveis

```typescript
const { data: payouts } = useQuery({
  queryKey: ['ranking-payouts', employeeIds, anoMesList],
  queryFn: async () => {
    // Mapear employees.email → sdr.email → sdr_month_payout
    const { data } = await supabase
      .from('sdr_month_payout')
      .select(`
        *,
        sdr:sdr_id(id, email, name)
      `)
      .in('ano_mes', anoMesList);
    
    return data;
  },
});
```

### Passo 3: Buscar comp plans para calcular OTE %

```typescript
const { data: compPlans } = useQuery({
  queryKey: ['ranking-comp-plans', sdrIds],
  queryFn: async () => {
    const { data } = await supabase
      .from('sdr_comp_plan')
      .select('sdr_id, ote_total, vigencia_inicio, vigencia_fim')
      .in('sdr_id', sdrIds);
    
    return data;
  },
});
```

### Passo 4: Calcular valor baseado na métrica selecionada

```typescript
const getMetricaValor = (
  metrica: MetricaRanking,
  payout: SdrMonthPayout | null,
  compPlan: SdrCompPlan | null
): number => {
  if (!payout) return 0;
  
  switch (metrica) {
    case 'agendamentos':
      return payout.meta_agendadas_ajustada || 0;
    case 'realizadas':
      return payout.pct_reunioes_realizadas || 0;
    case 'tentativas':
      return payout.pct_tentativas || 0;
    case 'ote_pct':
      if (!compPlan?.ote_total) return 0;
      return ((payout.total_conta || 0) / compPlan.ote_total) * 100;
    case 'taxa_conversao':
      // Precisa buscar de outra fonte
      return 0;
    default:
      return 0;
  }
};
```

### Passo 5: Vincular employee → SDR

O campo de ligação é o **email**:
- `employees.email` (emails pessoais de colaboradores)
- `sdr.email` (registro do SDR no fechamento)

```typescript
// Mapear employees com seus payouts via email
const participantes = employees.map(emp => {
  const sdrPayout = payouts?.find(p => 
    p.sdr?.email?.toLowerCase() === emp.email?.toLowerCase()
  );
  const compPlan = compPlans?.find(cp => cp.sdr_id === sdrPayout?.sdr_id);
  
  return {
    id: emp.id,
    nome: emp.nome_completo,
    valor: getMetricaValor(premiacao.metrica_ranking, sdrPayout, compPlan),
    // ...
  };
});
```

---

## Dependências Adicionais

Para métricas que não estão no payout (como `agendamentos` absolutos ou `contratos`), será necessário:

1. **Buscar do sdr_month_kpi**: Para contagens absolutas
2. **Buscar da Agenda**: Para contratos no período específico

---

## Resultado Esperado

Após a implementação:

| Posição | Colaborador | OTE % |
|---------|-------------|-------|
| 🥇 | Jessica Martins | 84% |
| 🥈 | Carol Correa | 59% |
| 🥉 | Cristiane Gomes | 57% |
| 4 | Antony Elias | 56% |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/premiacoes/RankingLeaderboard.tsx` | Integrar busca de payouts e comp plans, calcular métrica real baseada no campo selecionado |

---

## Considerações

1. **Vínculo employee ↔ SDR**: Usar email como chave de ligação
2. **Período multi-mês**: Se premiação durar 2+ meses, somar/média dos payouts
3. **Métricas da Agenda**: Para `contratos` e `taxa_conversao`, buscar diretamente da agenda/hubla
4. **Fallback**: Se não encontrar payout, mostrar 0 ao invés de erro
