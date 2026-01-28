
# Reformulação: Fechamento SDR para Fechamento da Equipe

## Visão Geral

O sistema atual de "Fechamento SDR" será reformulado para "Fechamento da Equipe", suportando todos os cargos de uma BU (SDRs, Closers, Coordenadores, etc.) com métricas configuráveis por cargo e mês.

---

## Problemas a Resolver

| Problema | Situação Atual | Solução |
|----------|---------------|---------|
| Nomenclatura | "Fechamento SDR" | "Fechamento da Equipe" |
| Cargos limitados | Apenas SDR/Closer via `role_type` | Todos os cargos via integração com `employees` e `cargos_catalogo` |
| Métricas fixas | 4 métricas hardcoded (Agendadas, Realizadas, Tentativas, Organização) | Métricas dinâmicas selecionáveis por mês/cargo |
| Calendário compacto | Lista completa sem agrupamento | Expandir/recolher por ano + filtros |

---

## Arquitetura Proposta

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    CONFIGURAÇÕES DE FECHAMENTO                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Equipe]  [Planos OTE]  [Métricas Ativas]  [Dias Úteis]            │
│                                                                      │
│  ┌─ ABA EQUIPE ─────────────────────────────────────────────────┐   │
│  │ Filtros: [BU ▼] [Cargo ▼] [Status ▼]                         │   │
│  │                                                               │   │
│  │ Nome            Cargo        BU           Nível   Ativo      │   │
│  │ Carol Correa    SDR          Incorporador N2      ✓          │   │
│  │ João Silva      Closer       Incorporador N3      ✓          │   │
│  │ Maria Santos    Coordenador  Incorporador N5      ✓          │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ ABA MÉTRICAS ATIVAS (NOVO) ─────────────────────────────────┐   │
│  │ Mês: [Janeiro 2026 ▼]    Cargo: [SDR ▼]                      │   │
│  │                                                               │   │
│  │ ☑ Agendamentos       [30%]  Meta: 100                        │   │
│  │ ☑ Contratos          [40%]  Meta: 5                          │   │
│  │ ☑ Organização        [30%]  Meta: 100%                       │   │
│  │ ☐ R1 Realizadas      [-]                                     │   │
│  │ ☐ Tentativas         [-]                                     │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ ABA DIAS ÚTEIS ─────────────────────────────────────────────┐   │
│  │ ▼ 2026              ▶ 2025                   [+ Adicionar]   │   │
│  │   ├── Janeiro   22 dias  R$ 660                              │   │
│  │   ├── Fevereiro 18 dias  R$ 540                              │   │
│  │   └── ...                                                     │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Mudanças Detalhadas

### 1. Nomenclatura e Títulos

| Local | Antes | Depois |
|-------|-------|--------|
| Página título | "Configurações de Fechamento SDR" | "Configurações de Fechamento" |
| Subtítulo | "Gerencie SDRs e planos OTE" | "Gerencie equipe, planos de compensação e métricas" |
| Tab "SDRs" | "SDRs" | "Equipe" |
| Botão | "+ Novo SDR" | "+ Novo Membro" |

### 2. Aba "Equipe" - Integração com Employees

Substituir a lista atual que puxa da tabela `sdr` para:
- Puxar da tabela `employees` com join em `cargos_catalogo`
- Filtrar por `departamento` (BU)
- Mostrar cargo do catálogo como referência
- Manter link com `sdr_id` para cálculo de payout

**Colunas da nova tabela:**
| Coluna | Origem |
|--------|--------|
| Nome | `employees.nome_completo` |
| Email | `employees.email_pessoal` ou perfil |
| Cargo | `cargos_catalogo.nome_exibicao` via FK |
| BU | `employees.departamento` |
| Nível | `employees.nivel` |
| Ativo | `employees.status = 'ativo'` |
| Ações | Editar, Ativar/Desativar |

### 3. Nova Aba "Métricas Ativas" (para Planos OTE dinâmicos)

Nova tabela: `fechamento_metricas_mes`

```sql
CREATE TABLE fechamento_metricas_mes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_mes TEXT NOT NULL,           -- "2026-01"
  cargo_catalogo_id UUID REFERENCES cargos_catalogo(id),
  squad TEXT,                      -- "incorporador", "consorcio", etc
  nome_metrica TEXT NOT NULL,      -- "agendamentos", "contratos", "organizacao"
  label_exibicao TEXT NOT NULL,    -- "Agendamentos R1", "Contratos Pagos"
  peso_percentual NUMERIC(5,2),    -- 30.00 = 30%
  meta_valor NUMERIC,              -- Meta numérica do mês
  fonte_dados TEXT,                -- "agenda", "hubla", "manual"
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ano_mes, cargo_catalogo_id, squad, nome_metrica)
);
```

**Interface de configuração:**
1. Selecionar Mês + Cargo
2. Checkboxes para ativar/desativar métricas
3. Campo de peso percentual para cada métrica ativa
4. Campo de meta para cada métrica ativa
5. Botão "Copiar do mês anterior"

### 4. Aba "Dias Úteis" - Expandir/Recolher por Ano

**Mudanças na UI:**
- Agrupar meses por ano em seções colapsáveis
- Estado inicial: ano atual expandido, anos anteriores recolhidos
- Ícone de seta indicando estado expandido/recolhido
- Contador de meses por ano no header

**Implementação:**
```tsx
const [expandedYears, setExpandedYears] = useState<Set<string>>(
  new Set([currentYear.toString()])
);

// Agrupar dados
const groupedByYear = useMemo(() => {
  return workingDays?.reduce((acc, wd) => {
    const year = wd.ano_mes.split('-')[0];
    if (!acc[year]) acc[year] = [];
    acc[year].push(wd);
    return acc;
  }, {} as Record<string, WorkingDay[]>);
}, [workingDays]);
```

---

## Arquivos a Criar/Modificar

### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/components/fechamento/TeamMembersTab.tsx` | Nova aba Equipe com integração employees |
| `src/components/fechamento/ActiveMetricsTab.tsx` | Nova aba Métricas Ativas |
| `src/hooks/useFechamentoMetricas.ts` | Hook para nova tabela de métricas por mês |

### Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/fechamento-sdr/Configuracoes.tsx` | Renomear títulos, adicionar novas abas, refatorar tabs |
| `src/components/sdr-fechamento/WorkingDaysCalendar.tsx` | Implementar agrupamento por ano com expand/collapse |
| `src/types/sdr-fechamento.ts` | Adicionar tipos para métricas dinâmicas |

---

## Migração de Dados

### SQL para nova tabela de métricas

```sql
-- 1. Criar tabela de métricas por mês
CREATE TABLE IF NOT EXISTS fechamento_metricas_mes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_mes TEXT NOT NULL,
  cargo_catalogo_id UUID REFERENCES cargos_catalogo(id),
  squad TEXT,
  nome_metrica TEXT NOT NULL,
  label_exibicao TEXT NOT NULL,
  peso_percentual NUMERIC(5,2) DEFAULT 25,
  meta_valor NUMERIC,
  fonte_dados TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ano_mes, cargo_catalogo_id, squad, nome_metrica)
);

-- 2. Habilitar RLS
ALTER TABLE fechamento_metricas_mes ENABLE ROW LEVEL SECURITY;

-- 3. Políticas
CREATE POLICY "Managers can manage metrics" ON fechamento_metricas_mes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );
```

---

## Fluxo de Configuração de Métricas

```text
1. Admin acessa "Métricas Ativas"
                 ↓
2. Seleciona Mês: Janeiro 2026
                 ↓
3. Seleciona Cargo: SDR (via cargos_catalogo)
                 ↓
4. Sistema mostra métricas disponíveis:
   - Agendamentos (peso 30%, meta 100)
   - Contratos (peso 40%, meta 5)
   - Organização (peso 30%, meta 100%)
                 ↓
5. Admin ajusta pesos e metas
                 ↓
6. Salva configuração para aquele mês/cargo
                 ↓
7. No cálculo do payout, sistema usa métricas ativas do mês
```

---

## Sequência de Implementação

### Fase 1: Renomear e Ajustar UI (Imediato)
1. Renomear títulos e labels na página de configurações
2. Mudar nome da aba "SDRs" para "Equipe"
3. Implementar expand/collapse no calendário de dias úteis

### Fase 2: Integração com Employees (Próximo)
1. Criar `TeamMembersTab.tsx` usando `useEmployees()`
2. Adicionar filtros por BU, Cargo, Status
3. Manter sincronização com tabela `sdr` existente

### Fase 3: Métricas Dinâmicas (Futuro)
1. Criar tabela `fechamento_metricas_mes`
2. Criar hook `useFechamentoMetricas`
3. Criar componente `ActiveMetricsTab.tsx`
4. Modificar lógica de cálculo de payout para usar métricas dinâmicas

---

## Resultado Esperado

| Item | Antes | Depois |
|------|-------|--------|
| Membros | Apenas SDRs/Closers | Qualquer cargo da BU |
| Métricas | 4 fixas (agendadas, realizadas, tentativas, org) | Configuráveis por mês/cargo |
| Dias úteis | Lista longa | Agrupado por ano, colapsável |
| Escopo | Específico para Inside Sales | Toda a equipe da BU |
