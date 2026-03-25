

## Limpeza de rotas e módulos mortos

### Rotas a remover

| Rota | Arquivos | Motivo |
|------|----------|--------|
| `/custos/*` (3 sub-rotas) | 4 arquivos em `src/pages/custos/` | 100% mock data |
| `/receita` index (Overview) | `src/pages/receita/Overview.tsx` | Mock KPIs hardcoded |
| `/receita/por-canal` | `src/pages/receita/PorCanal.tsx` | Mock `MOCK_CANAIS_RECEITA` |
| `/alertas` | `src/pages/Alertas.tsx` | Mock `MOCK_ALERTAS` |
| `/tarefas` | `src/pages/Tarefas.tsx` + `src/components/tasks/*` + `src/hooks/useTaskSpaces.ts` | Stub placeholder |

### Rotas de receita que FICAM (dados reais)
- `/receita/a010`, `/receita/transacoes`, `/receita/importar-hubla`, `/receita/auditoria`
- O layout wrapper `src/pages/receita/Index.tsx` fica, mas o index redirect muda de `ReceitaOverview` para `A010`

### Arquivos a deletar (16 arquivos)
1. `src/pages/custos/` — 4 arquivos (Index, Overview, Despesas, PorCategoria)
2. `src/pages/receita/Overview.tsx` — mock KPIs
3. `src/pages/receita/PorCanal.tsx` — mock canal data
4. `src/pages/Alertas.tsx` — mock alertas
5. `src/pages/Tarefas.tsx` — stub
6. `src/components/tasks/` — ~3 arquivos (TaskSpacesSidebar, CreateTaskSpaceDialog, etc.)
7. `src/hooks/useTaskSpaces.ts` — hook do módulo tarefas
8. `src/pages/EfeitoAlavanca.tsx` — órfã (sem rota)
9. `src/hooks/useEvolutionData.ts` — não importado por ninguém
10. `src/data/evolutionMockData.ts` — não importado por ninguém

### Edge Functions mortas (5 pastas)
- `cleanup-backfill-partners/`, `fix-null-stages/`, `fix-backfill-stages/`, `fix-r2-ownership/`, `reconcile-clint-ids/`

### Arquivos a editar

**`src/App.tsx`:**
- Remover imports: `Custos`, `CustosOverview`, `CustosDespesas`, `CustosPorCategoria`, `ReceitaOverview`, `ReceitaPorCanal`, `Alertas`, `Tarefas`
- Remover rotas linhas 174-178 (custos), 181 (alertas), 243 (tarefas)
- Remover sub-rotas `ReceitaOverview` (166) e `por-canal` (169)
- Mudar index de receita: `<Route index element={<Navigate to="a010" replace />} />`

**`src/pages/receita/Index.tsx`:**
- Remover tabs "Visão Geral" e "Por Canal" do array de tabs

**`src/components/layout/AppSidebar.tsx`:**
- Remover itens sidebar: "Custos", "Despesas", "Alertas", "Tarefas"

**`src/components/dashboard/RealTimeAlerts.tsx`:**
- Mudar `navigate('/alertas')` para não navegar (ou remover o link)

**`supabase/config.toml`:**
- Remover entradas das 5 edge functions mortas

**`src/data/mockData.ts`:**
- Limpar exports não referenciados após remoção dos consumidores

### O que NÃO muda
- Todas as rotas ativas (CRM, Consórcio, Incorporador, Marketing, RH, Patrimônio, Fechamento SDR, Playbook, Cobranças, Chairman, Admin)
- Hook `useRealtimeAlerts` — continua funcionando para o dropdown de alertas no header
- Dados reais de receita (A010, Transações, Importar, Auditoria)

