

## Plano: Adicionar filtros nas abas do Closer Detail

### Escopo
Criar um componente `CloserLeadsFilters` que será exibido acima da tabela nas 4 abas (Leads Realizados, No-Shows, R2 Agendadas, Faturamento). A aba "Visão Geral" permanece sem filtros.

Os filtros serão **client-side** — filtrando os dados já carregados (`leads`, `noShowLeads`, `r2Leads`).

### Filtros disponíveis
1. **Busca por texto** — filtra por nome, email ou telefone do lead
2. **Status** — Select com opções dinâmicas (Realizada, Contrato Pago, No-Show, Agendada, etc.)
3. **SDR** — Select com SDRs únicos extraídos dos dados
4. **Data** — Presets (Hoje, Semana, Mês, Custom com date pickers) que filtram dentro do período já carregado

### Implementação

**1. Novo componente: `src/components/closer/CloserLeadsFilters.tsx`**
- Props: `leads: CloserLead[]`, `onFilter: (filtered: CloserLead[]) => void`, `showR1Sdr?: boolean`
- Inputs: Input de busca, Select de status, Select de SDR, botões de período (Hoje/Semana/Mês/Custom) + date pickers
- Extrai listas únicas de status e SDRs dos leads recebidos
- Aplica filtros combinados e retorna leads filtrados via callback

**2. Atualizar `src/pages/crm/CloserMeetingsDetailPage.tsx`**
- Importar `CloserLeadsFilters`
- Para cada aba (leads, noshows, r2, faturamento), manter estado local de leads filtrados
- Renderizar `<CloserLeadsFilters>` acima do `<CloserLeadsTable>` dentro de cada `TabsContent`
- Passar leads filtrados ao `CloserLeadsTable` e contagem filtrada nos TabsTrigger

**3. Atualizar `src/components/closer/CloserRevenueTab.tsx`**
- Aceitar prop opcional `searchFilter?: string` e aplicar busca nos dados exibidos, ou integrar o mesmo componente de filtros

### Layout dos filtros
```text
┌─────────────────────────────────────────────────────────────┐
│ [🔍 Buscar nome, email, telefone]  [Status ▼]  [SDR ▼]     │
│ [Hoje] [Semana] [Mês] [📅 Início] — [📅 Fim]   [Limpar]   │
└─────────────────────────────────────────────────────────────┘
```

Compacto em uma ou duas linhas, seguindo o estilo visual do dashboard (dark theme, borders, outline buttons).

