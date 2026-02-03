
# Plano: Fechamento do Consórcio (SDR + Closers)

## Visão Geral

O sistema de fechamento do Consórcio terá **duas estruturas distintas**:

1. **SDRs do Consórcio** - Métricas configuráveis (como Incorporador), usando a mesma infraestrutura do `fechamento-sdr` já existente com filtro `squad = 'consorcio'`

2. **Closers do Consórcio** - Estrutura fixa baseada em comissões de vendas:
   - 70% Fixo / 30% Variável
   - Variável: 72% Comissão Venda Consórcio + 18% Venda Holding + 10% Organização

## Arquitetura Proposta

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                    FECHAMENTO CONSÓRCIO                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────┐         ┌─────────────────────────────┐         │
│  │    SDRs Consórcio       │         │    Closers Consórcio        │         │
│  │  (Métricas Dinâmicas)   │         │  (Estrutura Fixa: Comissões)│         │
│  └────────────┬────────────┘         └──────────────┬──────────────┘         │
│               │                                      │                        │
│               ▼                                      ▼                        │
│  ┌────────────────────────┐         ┌──────────────────────────────────┐     │
│  │  Reutiliza:            │         │  Novo:                           │     │
│  │  - sdr (squad=consorcio│         │  - consorcio_closer_payout       │     │
│  │  - sdr_month_payout    │         │  - consorcio_closer_kpi          │     │
│  │  - fechamento_metricas │         │  - consorcio_closer_comp_plan    │     │
│  │  - /fechamento-sdr     │         │  - /bu-consorcio/fechamento      │     │
│  └────────────────────────┘         └──────────────────────────────────┘     │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Parte 1: SDRs do Consórcio (JÁ FUNCIONA!)

Os SDRs do Consórcio **já são suportados** pelo sistema atual:
- Tabela `sdr` com `squad = 'consorcio'`
- Página `/fechamento-sdr` com filtro de BU = "Consórcio"
- Métricas configuráveis via `fechamento_metricas_mes`

**Nenhuma alteração necessária** - basta usar o filtro existente!

---

## Parte 2: Closers do Consórcio (NOVA IMPLEMENTAÇÃO)

### Estrutura de Compensação
```text
┌─────────────────────────────────────────┐
│            OTE TOTAL (100%)             │
├─────────────────────────────────────────┤
│  FIXO (70%)                             │
│    └── Valor fixo mensal                │
├─────────────────────────────────────────┤
│  VARIÁVEL (30%)                         │
│    ├── 72% → Comissão Venda Consórcio   │
│    ├── 18% → Comissão Venda Holding     │
│    └── 10% → Organização                │
└─────────────────────────────────────────┘
```

### Cálculo das Métricas

| Métrica | Fonte de Dados | Cálculo |
|---------|----------------|---------|
| **Comissão Venda Consórcio** | `consortium_installments` | Soma das comissões pagas no mês onde `status = 'pago'` |
| **Comissão Venda Holding** | Nova tabela ou campo | Vendas de produtos holding pelo closer |
| **Organização** | Manual | Score de 0-100 (CRM, docs, etc) |

---

## Alterações no Banco de Dados

### Tabela: `consorcio_closer_payout` (nova)
Fechamento mensal dos Closers do Consórcio

```sql
CREATE TABLE consorcio_closer_payout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id UUID REFERENCES closers(id) NOT NULL,
  ano_mes TEXT NOT NULL, -- '2026-02'
  
  -- OTE Base (do cargo_catalogo ou plano específico)
  ote_total NUMERIC DEFAULT 5000,
  fixo_valor NUMERIC DEFAULT 3500,    -- 70%
  variavel_total NUMERIC DEFAULT 1500, -- 30%
  
  -- KPIs do mês
  comissao_consorcio NUMERIC DEFAULT 0,      -- Valor em R$
  comissao_holding NUMERIC DEFAULT 0,        -- Valor em R$
  score_organizacao NUMERIC DEFAULT 100,     -- 0-100
  
  -- Metas (opcional, para calcular %)
  meta_comissao_consorcio NUMERIC,
  meta_comissao_holding NUMERIC,
  meta_organizacao NUMERIC DEFAULT 100,
  
  -- Performance %
  pct_comissao_consorcio NUMERIC,
  pct_comissao_holding NUMERIC,
  pct_organizacao NUMERIC,
  
  -- Multiplicadores
  mult_comissao_consorcio NUMERIC,
  mult_comissao_holding NUMERIC,
  mult_organizacao NUMERIC,
  
  -- Valores finais por métrica (peso × mult × base)
  valor_comissao_consorcio NUMERIC,  -- 72% do variável
  valor_comissao_holding NUMERIC,    -- 18% do variável
  valor_organizacao NUMERIC,         -- 10% do variável
  
  -- Totais
  valor_variavel_final NUMERIC,
  total_conta NUMERIC,
  
  -- Bônus
  bonus_extra NUMERIC DEFAULT 0,
  bonus_autorizado BOOLEAN DEFAULT false,
  
  -- Status e aprovação
  status TEXT DEFAULT 'DRAFT', -- DRAFT, APPROVED, LOCKED
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMPTZ,
  ajustes_json JSONB DEFAULT '[]',
  
  -- Auditoria
  dias_uteis_mes INTEGER DEFAULT 19,
  nfse_id UUID REFERENCES rh_nfse(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(closer_id, ano_mes)
);
```

### Tabela: `consorcio_venda_holding` (nova, opcional)
Para registrar vendas de holding atribuídas aos closers

```sql
CREATE TABLE consorcio_venda_holding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id UUID REFERENCES closers(id) NOT NULL,
  ano_mes TEXT NOT NULL,
  descricao TEXT,
  valor_venda NUMERIC NOT NULL,
  valor_comissao NUMERIC NOT NULL,
  data_venda DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
```

---

## Estrutura de Arquivos

### Novos Arquivos

```text
src/
├── types/
│   └── consorcio-fechamento.ts      # Tipos TS para o fechamento
│
├── hooks/
│   └── useConsorcioFechamento.ts    # Hooks para closers do consórcio
│
├── pages/
│   └── bu-consorcio/
│       ├── Fechamento.tsx           # Atualizar (lista closers)
│       ├── FechamentoDetail.tsx     # Novo (detalhe do closer)
│       └── FechamentoConfig.tsx     # Novo (configurações)
│
├── components/
│   └── consorcio-fechamento/
│       ├── CloserPayoutCard.tsx     # Card de resumo
│       ├── CloserKpiForm.tsx        # Edição de KPIs
│       ├── VendaHoldingList.tsx     # Lista de vendas holding
│       └── ConsorcioStatusBadge.tsx # Pode reutilizar existente
```

---

## Lógica de Cálculo (Closers)

### Pesos Fixos
```typescript
const PESOS_CLOSER_CONSORCIO = {
  comissao_consorcio: 0.72,  // 72% do variável
  comissao_holding: 0.18,    // 18% do variável
  organizacao: 0.10,         // 10% do variável
};
```

### Cálculo de Performance
```typescript
// Para comissões: % = (realizado / meta) * 100
const pct_comissao = meta > 0 ? (realizado / meta) * 100 : 100;

// Multiplicador usa mesma tabela do SDR
const mult = getMultiplier(pct_comissao); // 0, 0.5, 0.7, 1, 1.5

// Valor final por métrica
const valor = variavel_total * peso * mult;
```

### Buscar Comissões Automáticas
```typescript
// Comissão de vendas de consórcio
const { data: installments } = await supabase
  .from('consortium_installments')
  .select(`
    valor_comissao,
    card:card_id (vendedor_id)
  `)
  .eq('status', 'pago')
  .gte('data_pagamento', mesInicio)
  .lte('data_pagamento', mesFim);

// Filtrar pelo closer (via vendedor_id ou closer vinculado)
const comissao_consorcio = installments
  .filter(i => i.card?.vendedor_id === closerId)
  .reduce((sum, i) => sum + (i.valor_comissao || 0), 0);
```

---

## UI da Página de Fechamento

### Lista Principal (`/bu-consorcio/fechamento`)

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Fechamento Consórcio                                    [Fev 2026 ▼]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Recalcular Todos] [Exportar CSV] [Configurações]                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Total Fixo      │ Total Variável │ Total Conta               │   │
│  │ R$ 21.000       │ R$ 6.750       │ R$ 27.750                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Nome              │ Status  │ Fixo    │ Variável │ Total    │ Ação │
│  ─────────────────────────────────────────────────────────────────  │
│  João Pedro        │ DRAFT   │ R$3.500 │ R$1.125  │ R$4.625  │ [👁] │
│  Victoria Paz      │ APPROVED│ R$3.500 │ R$1.350  │ R$4.850  │ [👁] │
│  Luis Felipe       │ DRAFT   │ R$3.500 │ R$1.080  │ R$4.580  │ [👁] │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Detalhe do Closer (`/bu-consorcio/fechamento/:payoutId`)

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ← João Pedro Martins     [DRAFT]     [Closer]                      │
│  Fechamento de 2026-02                           [Exportar] [Aprovar]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐                    │
│  │OTE     │ │Fixo    │ │Variável│ │Total Conta │                    │
│  │R$5.000 │ │R$3.500 │ │R$1.125 │ │R$ 4.625    │                    │
│  │(RH)    │ │70%     │ │30%     │ │            │                    │
│  └────────┘ └────────┘ └────────┘ └────────────┘                    │
│                                                                      │
│  === INDICADORES DE META ===                                         │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Comissão Venda Consórcio (72%)                              │    │
│  │ Meta: R$ 2.000  │ Realizado: R$ 1.800  │ 90% │ ×0.7 │ R$756 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Comissão Venda Holding (18%)                                │    │
│  │ Meta: R$ 500   │ Realizado: R$ 600   │ 120% │ ×1.5 │ R$405 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Organização (10%)                                           │    │
│  │ Meta: 100  │ Realizado: 85  │ 85% │ ×0.5 │ R$75             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  [Editar KPIs]                                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Rotas a Adicionar (App.tsx)

```typescript
// Novas rotas para fechamento consórcio
<Route path="bu-consorcio/fechamento" element={<ConsorcioFechamento />} />
<Route path="bu-consorcio/fechamento/:payoutId" element={<ConsorcioFechamentoDetail />} />
<Route path="bu-consorcio/fechamento/configuracoes" element={<ConsorcioFechamentoConfig />} />
```

---

## Fases de Implementação

### Fase 1: Banco de Dados
1. Criar migration com tabelas `consorcio_closer_payout` e `consorcio_venda_holding`
2. Habilitar RLS
3. Atualizar types.ts do Supabase

### Fase 2: Tipos e Hooks
1. Criar `src/types/consorcio-fechamento.ts`
2. Criar `src/hooks/useConsorcioFechamento.ts` com:
   - `useConsorcioClosers()` - Lista closers ativos do consórcio
   - `useConsorcioPayouts()` - Lista fechamentos do mês
   - `useConsorcioPayoutDetail()` - Detalhe de um fechamento
   - `useRecalculateConsorcioPayouts()` - Recalcular todos
   - `useUpdateConsorcioPayoutKpi()` - Atualizar KPIs
   - `useUpdateConsorcioPayoutStatus()` - Aprovar/Travar

### Fase 3: Páginas e Componentes
1. Atualizar `src/pages/bu-consorcio/Fechamento.tsx`
2. Criar `src/pages/bu-consorcio/FechamentoDetail.tsx`
3. Criar `src/pages/bu-consorcio/FechamentoConfig.tsx`
4. Criar componentes auxiliares

### Fase 4: Integrações
1. Atualizar rotas em `App.tsx`
2. Edge function para recálculo automático (opcional)

---

## Resumo de Arquivos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Migration SQL | Criar | Tabelas de fechamento closer |
| `src/types/consorcio-fechamento.ts` | Criar | Tipos TypeScript |
| `src/hooks/useConsorcioFechamento.ts` | Criar | Hooks principais |
| `src/pages/bu-consorcio/Fechamento.tsx` | Atualizar | Lista de fechamentos |
| `src/pages/bu-consorcio/FechamentoDetail.tsx` | Criar | Detalhe do closer |
| `src/pages/bu-consorcio/FechamentoConfig.tsx` | Criar | Configurações |
| `src/components/consorcio-fechamento/*` | Criar | Componentes UI |
| `src/App.tsx` | Atualizar | Adicionar rotas |

---

## Observações

1. **SDRs do Consórcio** já funcionam via `/fechamento-sdr` com filtro BU = Consórcio

2. **Closers do Consórcio** terão página separada em `/bu-consorcio/fechamento`

3. A **fonte da tabela closers** (`bu = 'consorcio'`) já existe com 4 closers cadastrados

4. Para **Venda Holding**, criaremos uma tabela auxiliar para registro manual ou integramos com sistema existente de vendas
