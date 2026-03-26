

## Enriquecer a página de detalhe do SDR

### Problema
A página atual mostra KPIs agregados, um gráfico de barras e ranking — mas falta visão operacional do dia-a-dia: o gestor não consegue ver se o SDR bate meta todo dia, nem como estão as ligações dele.

### O que adicionar

#### 1. Cards de Ligações (seção nova)
Usar o hook `useSdrCallMetrics` (já existe, usado em "Minhas Reuniões") passando o email do SDR + período. Renderizar o componente `CallMetricsCards` (já existe) abaixo dos KPI cards, mostrando:
- Total Ligações
- Contatos (atendidas)
- Não Atendidas
- Tempo Médio

**Arquivo**: `SdrMeetingsDetailPage.tsx` — importar `useSdrCallMetrics` e `CallMetricsCards`, adicionar na aba "Visão Geral" entre os KPI cards e o gráfico.

#### 2. Tabela de Performance Diária (componente novo)
Criar `SdrDailyBreakdownTable.tsx` — tabela com uma linha por dia do período, colunas:

| Data | Agendamentos | R1 Agendada | R1 Realizada | No-Show | Meta | Status |
|------|-------------|-------------|--------------|---------|------|--------|

- **Meta**: buscar `meta_diaria` do SDR (da tabela `sdr`)
- **Status**: ícone verde (bateu) / vermelho (não bateu) comparando Agendamentos vs meta_diaria
- Dados calculados a partir dos `meetings` já carregados, agrupados por dia
- Linha de total no final

**Arquivo novo**: `src/components/sdr/SdrDailyBreakdownTable.tsx`
**Arquivo**: `SdrMeetingsDetailPage.tsx` — adicionar abaixo do gráfico + ranking, ocupando largura total

#### 3. Buscar meta_diaria do SDR
Criar query simples no `useSdrDetailData` para buscar `meta_diaria` da tabela `sdr` pelo email, ou fazer inline na page. Retornar como parte do `sdrDetailData`.

**Arquivo**: `useSdrDetailData.ts` — adicionar campo `metaDiaria` ao retorno, buscar da tabela `sdr`.

#### 4. Corrigir alert órfão
Na aba "Reuniões", o alert ainda menciona "aba Todos os Negócios" que foi removida. Remover esse alert.

**Arquivo**: `SdrMeetingsDetailPage.tsx` — deletar linhas 170-178.

### Layout final da aba "Visão Geral"

```text
┌─────────────────────────────────────────────────┐
│  KPI Cards (5 cards)                            │
├─────────────────────────────────────────────────┤
│  Ligações (4 cards compactos)                   │
├────────────────────────┬────────────────────────┤
│  Evolução Diária       │  Ranking no Time       │
│  (gráfico barras)      │  (tabela ranking)      │
├────────────────────────┴────────────────────────┤
│  Performance Diária (tabela dia-a-dia)          │
│  Data | Agend | R1 Ag | R1 Real | NoShow | Meta│
└─────────────────────────────────────────────────┘
```

### Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `src/components/sdr/SdrDailyBreakdownTable.tsx` | Criar — tabela diária com meta |
| `src/pages/crm/SdrMeetingsDetailPage.tsx` | Adicionar CallMetrics + DailyBreakdown, remover alert órfão |
| `src/hooks/useSdrDetailData.ts` | Adicionar `metaDiaria` ao retorno |

