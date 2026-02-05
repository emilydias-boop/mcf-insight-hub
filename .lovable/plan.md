

# Sistema de Metas Mensais da Equipe com Premiações

## Objetivo
Criar um sistema para configurar **metas mensais coletivas da equipe** (Meta, Supermeta, Ultrameta, Meta Divina) com seus respectivos valores-alvo e premiações, incluindo:

- **Ultrameta batida** → R$ 1.000 no iFood para **todos** da equipe (libera automaticamente)
- **Meta Divina batida** → R$ 50.000 para o **melhor SDR** + R$ 50.000 para o **melhor Closer** (premiação individual)

---

## Estrutura de Dados

### Nova Tabela: `team_monthly_goals`

```text
Colunas:
├── id (uuid, PK)
├── ano_mes (text) - formato "2026-01"
├── bu (text) - "incorporador", "consorcio", etc.
├── meta_valor (numeric) - ex: R$ 1.000.000
├── meta_premio_ifood (numeric) - ex: R$ 0 (não libera iFood)
├── supermeta_valor (numeric) - ex: R$ 1.300.000
├── supermeta_premio_ifood (numeric) - ex: R$ 500
├── ultrameta_valor (numeric) - ex: R$ 1.600.000
├── ultrameta_premio_ifood (numeric) - R$ 1.000 (para todos)
├── meta_divina_valor (numeric) - ex: R$ 2.000.000
├── meta_divina_premio_sdr (numeric) - R$ 50.000 (melhor SDR)
├── meta_divina_premio_closer (numeric) - R$ 50.000 (melhor Closer)
├── ativo_mes_atual (boolean) - se é a configuração ativa
├── created_by (uuid, FK)
├── created_at / updated_at (timestamp)
└── UNIQUE(ano_mes, bu)
```

### Nova Tabela: `team_monthly_goal_winners` (para registrar vencedores)

```text
Colunas:
├── id (uuid, PK)
├── goal_id (uuid, FK → team_monthly_goals)
├── tipo_premio (text) - 'ultrameta_ifood', 'divina_sdr', 'divina_closer'
├── sdr_id (uuid) - vencedor
├── valor_premio (numeric)
├── autorizado (boolean)
├── autorizado_por (uuid)
├── autorizado_em (timestamp)
└── created_at (timestamp)
```

---

## Alterações no Frontend

### 1. Nova Aba "Metas da Equipe" em Configurações

**Arquivo a modificar:** `src/pages/fechamento-sdr/Configuracoes.tsx`

Nova aba ao lado das existentes:

```text
Abas: [SDRs] [Planos OTE] [Dias Úteis] [Métricas Ativas] [Metas Equipe] [Planos OTE (Novo)]
                                                          ^^^^^^^^^^^^^ NOVA
```

### 2. Componente de Configuração

**Novo arquivo:** `src/components/fechamento/TeamMonthlyGoalsTab.tsx`

Interface visual:

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 🎯 Metas Mensais da Equipe                                                      │
│                                                                                 │
│ ← Janeiro 2026 →          BU: [Incorporador ▼]                                 │
│                                                                                 │
│ ┌─────────────────┬─────────────────┬─────────────────────────────────────────┐│
│ │ Nível           │ Valor Meta      │ Premiação                               ││
│ ├─────────────────┼─────────────────┼─────────────────────────────────────────┤│
│ │ 🟡 Meta         │ R$ [1.000.000]  │ iFood: R$ [0]                           ││
│ │ 🟠 Supermeta    │ R$ [1.300.000]  │ iFood: R$ [500]                         ││
│ │ 🔴 Ultrameta    │ R$ [1.600.000]  │ iFood: R$ [1.000] (para todos)          ││
│ │ 🌟 Meta Divina  │ R$ [2.000.000]  │ SDR: R$ [50.000] | Closer: R$ [50.000]  ││
│ └─────────────────┴─────────────────┴─────────────────────────────────────────┘│
│                                                                                 │
│ [Copiar do Mês Anterior]                                         [💾 Salvar]   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3. Hook de Gerenciamento

**Novo arquivo:** `src/hooks/useTeamMonthlyGoals.ts`

```text
Funções exportadas:
├── useTeamMonthlyGoals(anoMes, bu) - buscar configuração
├── useCreateTeamMonthlyGoals() - criar
├── useUpdateTeamMonthlyGoals() - atualizar
└── useCopyGoalsFromPreviousMonth() - copiar mês anterior
```

---

## Lógica de Premiação no Fechamento

### Fluxo de Liberação Automática

```text
1. Sistema calcula faturamento do mês (useUltrametaByBU)
   
2. Compara com team_monthly_goals:
   
   Faturamento >= Ultrameta?
   └─ SIM → Libera ifood_ultrameta para TODOS os payouts ativos
           (altera o valor de ifood_ultrameta de R$ 50 para R$ 1.000)
   
   Faturamento >= Meta Divina?
   └─ SIM → Identifica melhor SDR + melhor Closer (ranking do mês)
           └─ Cria registro em team_monthly_goal_winners
           └─ Admin visualiza e autoriza liberação
```

### Critério "Melhor Desempenho"

Para Meta Divina, o sistema calculará:
- **Melhor SDR**: Maior % Meta Global (média das métricas configuradas)
- **Melhor Closer**: Maior % Meta Global (média de Contratos + Organização)

O ranking já existe em `useRankingMetrics.ts` e `useSdrDetailData.ts`.

---

## Integração com Sistema Existente

### 1. Modificar `useUltrametaByBU.ts`

Atualmente usa valores fixos (`DEFAULT_TARGETS`). Alteração para buscar da nova tabela:

```typescript
// ANTES
const DEFAULT_TARGETS = { ultrameta_incorporador: 2500000 };

// DEPOIS
const { data: monthlyGoals } = useTeamMonthlyGoals(currentMonth, 'incorporador');
const ultrametaTarget = monthlyGoals?.ultrameta_valor || 1600000;
```

### 2. Modificar `recalculate-sdr-payout` Edge Function

Adicionar lógica para verificar se a ultrameta do time foi batida e ajustar o valor do `ifood_ultrameta`:

```typescript
// Buscar meta do time
const { data: teamGoal } = await supabase
  .from('team_monthly_goals')
  .select('*')
  .eq('ano_mes', ano_mes)
  .eq('bu', sdr.squad)
  .single();

// Calcular faturamento do mês
const teamRevenue = await calculateTeamRevenue(ano_mes, sdr.squad);

// Se bateu ultrameta, usar o valor do prêmio em vez do valor individual
if (teamGoal && teamRevenue >= teamGoal.ultrameta_valor) {
  payoutFields.ifood_ultrameta = teamGoal.ultrameta_premio_ifood; // R$ 1.000
} else {
  payoutFields.ifood_ultrameta = compPlan.ifood_ultrameta; // R$ 50 padrão
}
```

### 3. Nova seção na página de Fechamento (Index)

Mostrar resumo das metas do time no topo:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📊 Metas do Time - Janeiro 2026          Faturamento: R$ 2.100.000         │
│                                                                             │
│ ✅ Meta (R$ 1M)  ✅ Supermeta (R$ 1.3M)  ✅ Ultrameta (R$ 1.6M)  ✅ DIVINA! │
│                                                                             │
│ 🌟 Meta Divina batida! Premiar:                                            │
│    SDR: João Silva (Meta Global 142%)     [Autorizar R$ 50.000]            │
│    Closer: Julio Caetano (Conversão 41%)  [Autorizar R$ 50.000]            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/hooks/useTeamMonthlyGoals.ts` | **Criar** | Hooks CRUD para metas mensais |
| `src/components/fechamento/TeamMonthlyGoalsTab.tsx` | **Criar** | Componente de configuração |
| `src/components/fechamento/TeamGoalsSummary.tsx` | **Criar** | Resumo de metas batidas |
| `src/pages/fechamento-sdr/Configuracoes.tsx` | **Modificar** | Adicionar nova aba |
| `src/pages/fechamento-sdr/Index.tsx` | **Modificar** | Mostrar resumo das metas |
| `src/hooks/useUltrametaByBU.ts` | **Modificar** | Buscar targets da nova tabela |
| `supabase/functions/recalculate-sdr-payout/index.ts` | **Modificar** | Lógica de premiação automática |
| Migração SQL | **Criar** | Criar tabelas team_monthly_goals e team_monthly_goal_winners |

---

## Exemplo Janeiro 2026

```text
Configuração salva:
├── Meta:       R$ 1.000.000 → iFood: R$ 0
├── Supermeta:  R$ 1.300.000 → iFood: R$ 500
├── Ultrameta:  R$ 1.600.000 → iFood: R$ 1.000 (todos)
└── Meta Divina: R$ 2.000.000 → SDR: R$ 50k | Closer: R$ 50k

Resultado: Faturamento R$ 2.100.000 (Meta Divina batida!)

Efeitos:
├── Todos os payouts: ifood_ultrameta = R$ 1.000 (em vez de R$ 50)
├── Melhor SDR identificado: João Silva
├── Melhor Closer identificado: Julio Caetano
└── Admin autoriza premiações de R$ 50k para cada
```

---

## Migração SQL

```sql
-- Tabela de metas mensais do time
CREATE TABLE team_monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_mes TEXT NOT NULL,
  bu TEXT NOT NULL DEFAULT 'incorporador',
  
  -- Níveis de meta
  meta_valor NUMERIC DEFAULT 0,
  meta_premio_ifood NUMERIC DEFAULT 0,
  
  supermeta_valor NUMERIC DEFAULT 0,
  supermeta_premio_ifood NUMERIC DEFAULT 0,
  
  ultrameta_valor NUMERIC DEFAULT 0,
  ultrameta_premio_ifood NUMERIC DEFAULT 0,
  
  meta_divina_valor NUMERIC DEFAULT 0,
  meta_divina_premio_sdr NUMERIC DEFAULT 0,
  meta_divina_premio_closer NUMERIC DEFAULT 0,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(ano_mes, bu)
);

-- Tabela de vencedores/autorizações
CREATE TABLE team_monthly_goal_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES team_monthly_goals(id) ON DELETE CASCADE,
  tipo_premio TEXT NOT NULL, -- 'ultrameta_ifood', 'divina_sdr', 'divina_closer'
  sdr_id UUID REFERENCES sdr(id),
  valor_premio NUMERIC NOT NULL,
  autorizado BOOLEAN DEFAULT false,
  autorizado_por UUID REFERENCES auth.users(id),
  autorizado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE team_monthly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_monthly_goal_winners ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Admins can manage team_monthly_goals"
  ON team_monthly_goals FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'));

CREATE POLICY "All can view team_monthly_goals"
  ON team_monthly_goals FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage team_monthly_goal_winners"
  ON team_monthly_goal_winners FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'));

CREATE POLICY "All can view team_monthly_goal_winners"
  ON team_monthly_goal_winners FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

