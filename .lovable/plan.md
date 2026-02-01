
# Correção: Ranking mostrando 0% - Integração com Dados Reais

## Problema Identificado

O ranking está mostrando **0.0%** para todos porque:

1. **Vínculo incorreto**: O código tenta vincular employee ↔ SDR por email, mas a tabela `employees` não tem coluna email
2. **Campo sdr_id não está sendo buscado**: A query busca employees sem incluir o campo `sdr_id`
3. **Os dados existem**: O fechamento de Janeiro 2026 tem dados reais para todos os SDRs

| SDR | Total Conta | pct_agendadas | pct_realizadas |
|-----|-------------|---------------|----------------|
| Jessica Martins | R$ 5.040 | 83.5% | 94.0% |
| Carol Correa | R$ 3.660 | 96.7% | - |
| Leticia Nunes | R$ 3.480 | 97.9% | - |
| Antony Elias | R$ 3.360 | 90.0% | - |

---

## Solução Proposta

### Arquivo: `src/components/premiacoes/RankingLeaderboard.tsx`

**Mudança 1: Incluir `sdr_id` na query de employees**

```typescript
const { data, error } = await supabase
  .from('employees')
  .select('id, nome_completo, cargo, squad, departamento, sdr_id')  // Adicionado sdr_id
  .eq('status', 'ativo')
  .or(orFilter);
```

**Mudança 2: Vincular por `sdr_id` ao invés de email**

```typescript
// ANTES (quebrado - employees não tem email)
const empPayouts = typedPayouts.filter(p => 
  p.sdr?.email?.toLowerCase() === empEmail
);

// DEPOIS (correto - usar sdr_id direto)
const empPayouts = typedPayouts.filter(p => 
  p.sdr_id === emp.sdr_id
);
```

---

### Arquivo: `src/hooks/premiacoes/useRankingMetrics.ts`

**Mudança 3: Buscar payouts por sdr_id diretamente**

Para métricas de OTE%, quando não existe `ote_total` no comp_plan, usar o cálculo de **% Meta Global** (média dos percentuais):

```typescript
case 'ote_pct':
  // Se não tem OTE target configurado, calcular como % Meta Global
  if (!compPlan?.ote_total || compPlan.ote_total === 0) {
    // Usar média dos percentuais como fallback
    const pcts = [
      avgPayout('pct_reunioes_agendadas'),
      avgPayout('pct_reunioes_realizadas'),
      avgPayout('pct_tentativas'),
      avgPayout('pct_organizacao'),
    ].filter(p => p > 0);
    
    return pcts.length > 0 
      ? pcts.reduce((a, b) => a + b, 0) / pcts.length 
      : 0;
  }
  
  // Cálculo normal com OTE target
  const totalConta = sumPayout('total_conta');
  return (totalConta / compPlan.ote_total) * 100;
```

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────┐
│                     ANTES (Quebrado)                        │
├─────────────────────────────────────────────────────────────┤
│ employees.email (não existe) → sdr.email → sdr_month_payout │
│ Resultado: Não encontra correspondência → 0%                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     DEPOIS (Correto)                        │
├─────────────────────────────────────────────────────────────┤
│ employees.sdr_id → sdr_month_payout.sdr_id                  │
│ Resultado: Encontra dados reais → valores corretos          │
└─────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

Após a correção, o ranking mostrará os valores reais do fechamento:

| Posição | Colaborador | OTE Atingido (%) |
|---------|-------------|------------------|
| 🥇 | Jessica Martins | 83.5% |
| 🥈 | Leticia Nunes | 97.9% |
| 🥉 | Carol Correa | 96.7% |
| 4 | Antony Elias | 90.0% |
| 5 | Carol Souza | 97.1% |

*Se usar % Meta Global (média), Leticia seria a primeira como esperado*

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/premiacoes/RankingLeaderboard.tsx` | Incluir `sdr_id` na query de employees e vincular por `sdr_id` ao invés de email |
| `src/hooks/premiacoes/useRankingMetrics.ts` | Adicionar fallback para calcular % Meta Global quando OTE target não existe; adicionar campo `pct_organizacao` ao PayoutData |

---

## Nota Técnica

A métrica **OTE Atingido (%)** pode ser calculada de duas formas:

1. **Com OTE configurado**: `(total_conta / ote_total) × 100`
2. **Sem OTE configurado (fallback)**: Média dos percentuais de meta (agendadas, realizadas, tentativas, organização)

O fallback é necessário porque os planos de compensação (sdr_comp_plan) ainda não estão com status APPROVED na base de dados.
