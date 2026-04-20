

## Dashboard "Movimentações por Estágio" — Painel Comercial

### O que vamos entregar

Nova página dedicada no Painel Comercial em `/crm/movimentacoes` que responde:

> *"Quais leads passaram por cada estágio entre as datas X e Y, filtrando por pipeline e tags?"*

Lê a tabela `deal_activities` (`activity_type='stage_change'`) — fonte de verdade do histórico — e **não** depende de `created_at`/`stage_moved_at` do deal.

### UI

```
┌─ Movimentações por Estágio ────────────────────────────────────┐
│                                                                 │
│ [📅 01/04/26 → 15/04/26]  [Pipeline ▾]  [🏷️ Tags ▾(2)]  [Limpar]│
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Resumo por estágio                                        │   │
│ │ ─────────────────────────────────────────────────────────│   │
│ │ R1 Agendada     │ 42 leads únicos │ 51 passagens │ ▶    │   │
│ │ R1 Realizada    │ 28 leads únicos │ 30 passagens │ ▶    │   │
│ │ No-Show         │  9 leads únicos │  9 passagens │ ▶    │   │
│ │ Contrato Pago   │  6 leads únicos │  6 passagens │ ▶    │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─ Detalhe (clique num estágio acima pra filtrar) ─────────┐  │
│ │ Lead          │ Pipeline │ Estágio passado │ Quando      │  │
│ │ João Silva    │ Alpha    │ R1 Realizada    │ 03/04 14:22 │  │
│ │ João Silva    │ Alpha    │ Contrato Pago   │ 08/04 09:10 │  │
│ │ Maria Souza   │ Beta     │ R1 Agendada     │ 04/04 11:00 │  │
│ │ ...                                                        │  │
│ └─────────────────────────────────────────────────────────────│  │
└─────────────────────────────────────────────────────────────────┘
```

**Filtros (todos opcionais e independentes):**
- **Período**: range com calendário (DateRange, `numberOfMonths={2}`, ptBR) — padrão últimos 30 dias
- **Pipeline**: select com origens da BU ativa (reusa `useBUOriginIds`)
- **Tags**: `TagFilterPopover` (já existe) com modo AND/OR e regras "possui/não possui" — usa **tag atual** do lead (limitação documentada no tooltip)

**Tabela resumo (topo):**
- Linha por estágio do pipeline, ordenada conforme `crm_stages.stage_order`
- 3 colunas: Estágio | **Leads únicos** | **Passagens** (mostra os dois lado a lado conforme você pediu)
- Clique numa linha filtra a tabela detalhe abaixo

**Tabela detalhe (baixo):**
- Uma linha por **passagem** (`deal_activities` row): nome do lead, pipeline, estágio destino, timestamp
- Clique no nome → abre `LeadDetailDrawer` existente
- Paginada (50 por página); export CSV

### Lógica de dados

```ts
// Hook novo: src/hooks/useStageMovements.ts
useStageMovements({ originIds, startDate, endDate, tagFilters, tagOperator })

// Pseudocódigo:
1. SELECT * FROM deal_activities 
     WHERE activity_type = 'stage_change'
       AND created_at BETWEEN start AND end
       AND deal_id IN (deals da pipeline filtrada)
2. SELECT id, name, tags FROM crm_deals WHERE id IN (...) → aplica filtro de tags em memória
3. JOIN com crm_stages para nome+ordem do to_stage
4. Agrega:
   - byStage[stage] = { unique: Set<deal_id>, passes: count }
   - rows = [{ deal, stage, when }]
```

Reusa exatamente o padrão de `useClintFunnel`/`useClintFunnelByLeadType` (já fazem isso pra canal/lead-type).

### Por que dashboard separado e não dentro do CRM

- **CRM `/crm/negocios`** mostra **estado atual** dos leads (kanban, lista). Misturar histórico ali confunde.
- **Painel Comercial** já agrega métricas históricas (Reuniões Equipe, Funil) — é o lugar natural.
- Permite cruzar com outros relatórios da mesma seção sem poluir o operacional do SDR.

### Permissões

Rota: `/crm/movimentacoes` — acesso para `admin`, `manager`, `coordenador` (mesmo padrão de `reunioes-equipe`).

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/crm/MovimentacoesEstagio.tsx` | **NOVO** — página com filtros + 2 tabelas |
| `src/hooks/useStageMovements.ts` | **NOVO** — query agregada de `deal_activities` |
| `src/components/crm/StageMovementsSummaryTable.tsx` | **NOVO** — tabela resumo clicável |
| `src/components/crm/StageMovementsDetailTable.tsx` | **NOVO** — tabela detalhe paginada + export CSV |
| `src/App.tsx` | + `<Route path="crm/movimentacoes" ...>` com `RoleGuard` |
| `src/components/layout/AppSidebar.tsx` | + item "Movimentações" sob "Painel Comercial" |

### Validação

1. Abrir `/crm/movimentacoes` → range padrão últimos 30 dias, todas pipelines, sem tags → ver resumo populado
2. Selecionar pipeline Alpha + range 01/04–15/04 → contagens batem com export do CRM no período
3. Adicionar tag "VIP" → leads únicos cai, passagens cai proporcionalmente
4. Clicar em "R1 Realizada" no resumo → tabela detalhe filtra
5. Lead que foi pra R1 Realizada 2x: aparece **1x em "leads únicos"** e **2x em "passagens"** + 2 linhas na tabela detalhe
6. Export CSV traz todas as passagens filtradas
7. Tag adicionada hoje: lead aparece mesmo se a movimentação foi semana passada (limitação documentada com ⓘ)

### Escopo

- 4 arquivos novos, 2 editados
- Zero migrations, zero RLS (já existem em `deal_activities`)
- Reusa: `TagFilterPopover`, `Calendar/Popover`, `useBUOriginIds`, `LeadDetailDrawer`, padrão de `useClintFunnel`
- Custo de query: 1 SELECT em `deal_activities` no range + 1 IN nos deal_ids encontrados (igual ao funil atual)

