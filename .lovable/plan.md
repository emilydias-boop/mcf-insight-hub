

# Próximos Passos: Resumo de Metas da Equipe e Lógica de Premiação

## 1. Criar Componente `TeamGoalsSummary.tsx`

**Objetivo**: Exibir na página de Fechamento um resumo visual das metas da equipe e prêmios liberados.

**Funcionalidades**:
- Buscar configurações de metas da equipe (`team_monthly_goals`) para o mês/BU selecionado
- Calcular faturamento total do time (usando `useUltrametaByBU`)
- Comparar com Meta, Supermeta, Ultrameta e Meta Divina
- Mostrar qual nível foi atingido com badge visual
- Se **Ultrameta batida**: mostrar "iFood R$ 1.000 liberado para todos"
- Se **Meta Divina batida**: identificar melhor SDR e melhor Closer e mostrar botões para autorizar premiações

**Estrutura Visual**:
```
┌────────────────────────────────────────────────────────────────┐
│ 📊 Metas do Time - Janeiro 2026                                │
│ Faturamento: R$ 2.100.000                                       │
│                                                                 │
│ ✅ Meta    ✅ Supermeta  ✅ Ultrameta (iFood +R$ 1.000)  ✅ DIVINA! │
│                                                                 │
│ 🌟 Meta Divina Batida! Premiar:                                │
│    SDR: João Silva (Meta Global 142%) [Autorizar R$ 50.000]   │
│    Closer: Julio Caetano (% Contratos 102%) [Autorizar...]    │
└────────────────────────────────────────────────────────────────┘
```

**Arquivo**: `src/components/fechamento/TeamGoalsSummary.tsx`

**Props**:
- `anoMes: string` - Mês selecionado (ex: "2026-01")
- `bu?: string` - BU selecionada (fallback: primeira BU do payout)

---

## 2. Integrar `TeamGoalsSummary` na Página Index

**Arquivo**: `src/pages/fechamento-sdr/Index.tsx`

**Mudanças**:
- Importar `TeamGoalsSummary`
- Adicionar logo após a seção de filtros, antes do resumo financeiro
- Passar `selectedMonth` e `squadFilter` (ou extrair BU do primeiro payout)

**Posicionamento**:
```
┌─ Header com título e controles
├─ Filtros (Search, Role, BU)
├─ ⭐ NOVO: TeamGoalsSummary (aqui)
├─ Resumo financeiro (4 cards)
├─ Alertas
└─ Tabela de payouts
```

---

## 3. Implementar Lógica de Premiação na Edge Function

**Arquivo**: `supabase/functions/recalculate-sdr-payout/index.ts`

**Mudanças necessárias**:

### 3.1. Buscar Metas da Equipe e Faturamento

Após calcular os payouts individuais, adicionar lógica que:
1. Busca `team_monthly_goals` para o mês/BU
2. Calcula faturamento total do BU (usando mesma lógica de `useUltrametaByBU`)
3. Compara com `ultrameta_valor` e `meta_divina_valor`

### 3.2. Se Ultrameta Batida

Se `faturamento >= team_monthly_goals.ultrameta_valor`:
- Ajustar `ifood_ultrameta` de cada payout para `team_monthly_goals.ultrameta_premio_ifood` (ex: R$ 1.000)
- Em vez de manter o valor padrão do comp_plan (R$ 50)

**Lógica**:
```typescript
if (teamGoal && teamRevenue >= teamGoal.ultrameta_valor) {
  payoutFields.ifood_ultrameta = teamGoal.ultrameta_premio_ifood; // R$ 1.000
} else {
  payoutFields.ifood_ultrameta = compPlan.ifood_ultrameta; // R$ 50 (padrão)
}
```

### 3.3. Se Meta Divina Batida

Se `faturamento >= team_monthly_goals.meta_divina_valor`:
1. Identificar **melhor SDR**: maior % Meta Global entre SDRs
2. Identificar **melhor Closer**: maior % Meta Global entre Closers
3. Criar registros em `team_monthly_goal_winners` com `tipo_premio = 'divina_sdr'` e `'divina_closer'`

**Dados a registrar**:
```typescript
{
  goal_id: team_monthly_goals.id,
  tipo_premio: 'divina_sdr' | 'divina_closer',
  sdr_id: best_sdr_id,
  valor_premio: team_monthly_goals.meta_divina_premio_sdr (ou _closer),
  autorizado: false, // Requer aprovação manual
  autorizado_por: null,
  autorizado_em: null,
}
```

### 3.4. Cálculo de "Melhor Desempenho"

Para identificar o vencedor, usar o **% Meta Global** já calculado no payout:
- Para SDRs: média de (agendamento, realizadas, tentativas, organização)
- Para Closers: % Contratos (armazenado em `pct_reunioes_agendadas`)

**Pseudocódigo**:
```typescript
// Após processar todos os payouts
const sdrPayouts = payouts.filter(p => !p.isCloser);
const closerPayouts = payouts.filter(p => p.isCloser);

const bestSdr = sdrPayouts.reduce((max, p) => 
  p.pct_media_global > max.pct_media_global ? p : max
);

const bestCloser = closerPayouts.reduce((max, p) => 
  p.pct_reunioes_agendadas > max.pct_reunioes_agendadas ? p : max
);

// Criar registros de vencedores
if (bestSdr) {
  await supabase.from('team_monthly_goal_winners').insert({
    goal_id: teamGoal.id,
    tipo_premio: 'divina_sdr',
    sdr_id: bestSdr.sdr_id,
    valor_premio: teamGoal.meta_divina_premio_sdr,
    autorizado: false,
  });
}

if (bestCloser) {
  await supabase.from('team_monthly_goal_winners').insert({
    goal_id: teamGoal.id,
    tipo_premio: 'divina_closer',
    sdr_id: bestCloser.sdr_id,
    valor_premio: teamGoal.meta_divina_premio_closer,
    autorizado: false,
  });
}
```

---

## Sequência de Implementação

1. **Criar `TeamGoalsSummary.tsx`** com busca de dados e UI
2. **Integrar em `Index.tsx`** e testar visualização
3. **Modificar edge function** para:
   - Buscar team_monthly_goals
   - Calcular faturamento por BU
   - Ajustar ifood_ultrameta se batido
   - Registrar vencedores Meta Divina

---

## Dependências Entre Componentes

```
TeamGoalsSummary
├── useTeamMonthlyGoals (já existe ✅)
├── useUltrametaByBU (já existe, mas usaremos internamente)
└── useTeamMonthlyGoalWinners (já existe ✅)

recalculate-sdr-payout (edge function)
└── Precisa do código de cálculo de faturamento + lógica Meta Divina
```

---

## Impacto na Experiência

- **Gestores**: Veem resumo das metas em tempo real na página de fechamento
- **Admin**: Recebe notificação quando Meta Divina é batida e autoriza premiações
- **SDRs/Closers**: iFood aumenta automaticamente se equipe atingir Ultrameta

