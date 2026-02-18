

# Adicionar BU Marketing com Dashboard de Dados de Anuncios

## Contexto

A BU Marketing foi criada no RH mas nao aparece no sidebar porque `'marketing'` nao existe como `BusinessUnit` valida no codigo. Alem disso, essa BU precisa de paginas especificas de analytics de marketing (nao apenas CRM clone).

### Dados Disponiveis no Banco

Os dados ja existem para alimentar os dashboards:

- **`hubla_transactions`**: possui campos `utm_source`, `utm_campaign`, `utm_medium` com ~3.093 registros tagueados (maioria de Facebook Ads)
- **`daily_costs`**: gasto diario de ads (~R$13-16k/dia), campo `campaign_name` e `source`
- **`weekly_metrics`**: metricas semanais com CPL, ROAS, ROI, leads, etc.

---

## Implementacao

### 1. Registrar "marketing" como BusinessUnit valida

**Arquivo: `src/hooks/useMyBU.ts`**
- Adicionar `'marketing'` ao type `BusinessUnit`
- Adicionar ao array `BU_OPTIONS`

### 2. Sidebar - Menu da BU Marketing

**Arquivo: `src/components/layout/AppSidebar.tsx`**
- Adicionar entrada "BU - Marketing" com icone `Megaphone`
- Subitens iniciais:
  - **Dashboard Ads** (`/bu-marketing`) - visao geral de performance
  - **Campanhas** (`/bu-marketing/campanhas`) - analise por campanha
  - **Documentos Estrategicos** (`/bu-marketing/documentos-estrategicos`)
- Adicionar `marketing` ao `BU_CRM_BASE_PATH`
- Adicionar `'marketing'` ao `buPriority` em `getCRMBasePath`

### 3. Dashboard de Marketing (pagina principal)

**Novo arquivo: `src/pages/bu-marketing/MarketingDashboard.tsx`**

KPIs no topo:
- Gasto Total (soma de `daily_costs` no periodo)
- Total de Leads (contagem de `hubla_transactions` com UTM)
- CPL (Custo por Lead = gasto / leads)
- Receita Gerada (soma de `net_value` das transacoes com UTM)

Graficos:
- Gasto diario (line chart de `daily_costs`)
- Leads por dia (bar chart de `hubla_transactions` agrupado por `sale_date`)

### 4. Pagina de Campanhas

**Novo arquivo: `src/pages/bu-marketing/CampanhasDashboard.tsx`**

Tabela principal:
- Campanha (`utm_campaign`)
- Adset/Conjunto (`utm_medium`)
- Leads (count)
- Receita (sum `net_value`)
- CPL calculado (se houver custo por campanha)

Filtros:
- Periodo (date range)
- Fonte (`utm_source`: FB, organic, manychat, ig)

Isso responde as perguntas:
- "Qual anuncio vai melhor?" -> ranking por leads e receita
- "Qual categoria traz mais pessoas?" -> agrupamento por adset
- "Qual link mais usado e por qual anuncio?" -> detalhamento UTM

### 5. Hook de dados

**Novo arquivo: `src/hooks/useMarketingMetrics.ts`**
- `useMarketingOverview(startDate, endDate)`: busca KPIs agregados
- `useCampaignBreakdown(startDate, endDate)`: busca detalhamento por campanha/adset
- Fontes: `daily_costs` + `hubla_transactions` (join por periodo)

### 6. Rotas

**Arquivo: `src/App.tsx`**
- Adicionar rotas:

```text
/bu-marketing              -> MarketingDashboard
/bu-marketing/campanhas    -> CampanhasDashboard
/bu-marketing/documentos-estrategicos -> DocumentosEstrategicos bu="marketing"
```

### 7. Contextos auxiliares

**Arquivo: `src/pages/crm/BUCRMLayout.tsx`**
- Adicionar `marketing: [...]` ao `BU_VISIBLE_TABS` (caso futuramente precise de CRM)

**Arquivo: `src/components/relatorios/BUReportCenter.tsx`**
- Adicionar `marketing` ao `BU_NAMES`

**Arquivo: `src/pages/admin/ConfiguracaoBU.tsx`**
- Adicionar `{ value: 'marketing', label: 'BU - Marketing' }` ao `BU_OPTIONS`

---

## Arquivos Novos

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/bu-marketing/MarketingDashboard.tsx` | Dashboard principal com KPIs e graficos |
| `src/pages/bu-marketing/CampanhasDashboard.tsx` | Tabela de campanhas com filtros |
| `src/hooks/useMarketingMetrics.ts` | Hooks para buscar dados de marketing |

## Arquivos Alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useMyBU.ts` | Adicionar `'marketing'` ao type e options |
| `src/components/layout/AppSidebar.tsx` | Adicionar menu BU Marketing + base path |
| `src/App.tsx` | Adicionar rotas `/bu-marketing/*` |
| `src/pages/crm/BUCRMLayout.tsx` | Adicionar `marketing` ao `BU_VISIBLE_TABS` |
| `src/components/relatorios/BUReportCenter.tsx` | Adicionar `marketing` ao `BU_NAMES` |
| `src/pages/admin/ConfiguracaoBU.tsx` | Adicionar opcao marketing |
| `src/pages/Home.tsx` | Adicionar marketing ao `BU_CONFIG` (opcional) |

## Resultado Esperado

- BU Marketing aparece no sidebar para usuarios com `squad` contendo `'marketing'` (e admins)
- Dashboard mostra gasto de ads, leads gerados, CPL e receita
- Pagina de campanhas responde: qual anuncio performa melhor, qual adset traz mais gente
- Tudo usando dados que ja existem no banco (sem necessidade de novas tabelas)

