

# Dashboard de Campanhas com Analytics Completo

## Objetivo

Transformar a pagina de Campanhas em um painel analitico completo, com:
- KPIs totais do periodo
- Rankings agregados por **Canal**, **Campanha**, **Bloco do Anuncio** e **Anuncio**
- Numeros claros: Leads, Receita, Receita/Lead (ticket medio)

## Estrutura da Nova Pagina

### 1. KPIs no topo (Cards resumo)

4 cards com os totais do periodo filtrado:

| Card | Valor |
|---|---|
| Total de Leads | Soma de leads com UTM |
| Receita Total | Soma de `net_value` |
| Ticket Medio | Receita / Leads |
| Campanhas Ativas | Quantidade distinta de campanhas |

### 2. Tabs com Rankings por Dimensao

Usar componente `Tabs` com 4 abas:

- **Por Canal** - Agrupa por `utm_source` (ex: FB, IG, Google)
- **Por Campanha** - Agrupa por `utm_campaign`
- **Por Bloco do Anuncio** - Agrupa por `utm_medium`
- **Por Anuncio** - Agrupa por `utm_content`

Cada aba mostra uma tabela rankeada por Leads (decrescente) com colunas:

| Coluna | Descricao |
|---|---|
| Nome | O valor da dimensao (canal, campanha, etc.) |
| Leads | Quantidade |
| Receita | Soma de net_value |
| Ticket Medio | Receita / Leads |
| % Leads | Percentual do total |

### 3. Tabela Detalhada (mantida)

A tabela atual de "Ranking de Campanhas" com todas as colunas (Campanha + Bloco + Anuncio + Canal + Leads + Receita) sera mantida abaixo das tabs, como visao granular.

## Alteracoes Tecnicas

### Arquivo: `src/hooks/useMarketingMetrics.ts`

Criar novo hook `useDimensionBreakdown` que recebe a dimensao (`utm_source`, `utm_campaign`, `utm_medium`, `utm_content`) e retorna dados agregados:

```typescript
interface DimensionRow {
  name: string;
  leads: number;
  revenue: number;
  ticketMedio: number;
  percentLeads: number;
}
```

O hook reutiliza os mesmos dados do `useCampaignBreakdown` (ja carregados), fazendo o agrupamento no frontend por dimensao selecionada.

### Arquivo: `src/pages/bu-marketing/CampanhasDashboard.tsx`

1. Adicionar 4 cards KPI no topo (calculados a partir dos dados de campanhas)
2. Adicionar componente `Tabs` com 4 abas (Canal, Campanha, Bloco, Anuncio)
3. Cada aba renderiza uma tabela com os dados agregados por aquela dimensao
4. Manter tabela detalhada existente abaixo

### Componentes usados

- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (ja disponivel em `@/components/ui/tabs`)
- `Card`, `Table`, `Badge` (ja usados)
- `formatCurrency`, `formatNumber` (ja usados)

## Layout Visual

```text
+--------------------------------------------------+
| [Megaphone] Campanhas                             |
| Analise por campanha, adset e fonte               |
+--------------------------------------------------+
| Periodo: [01/02 - 28/02]  Fonte: [Todas]         |
+--------------------------------------------------+
| [Leads: 1.048] [Receita: R$78k] [Ticket: R$74]  [95 campanhas] |
+--------------------------------------------------+
| [Canal] [Campanha] [Bloco do Anuncio] [Anuncio]  |
|--------------------------------------------------|
| Nome           | Leads | Receita | Ticket | %    |
| FB             | 1.020 | R$75k   | R$74   | 97%  |
| IG             |    28 | R$3k    | R$107  |  3%  |
+--------------------------------------------------+
| Ranking Detalhado (tabela atual completa)         |
+--------------------------------------------------+
```

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/bu-marketing/CampanhasDashboard.tsx` | KPIs, Tabs com 4 dimensoes, tabela detalhada |
| `src/hooks/useMarketingMetrics.ts` | Novo hook `useDimensionBreakdown` |

