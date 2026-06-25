# Daily View — Relatórios · BU Incorporador MCF

Painel diário consolidado mostrando, **no dia de hoje**, como o time fechou **ontem** (último dia útil) contra a meta. Visual no design system do app (verde-lima `#bfff00` + preto quente), com cards flutuantes, gauges e badges de status.

## 1. Localização e navegação

- Novo item no seletor `ReportTypeSelector`: **"Daily View"** (`daily_view`).
- Adicionado ao array `availableReports` em `src/pages/bu-incorporador/Relatorios.tsx`.
- Renderiza um novo componente `DailyViewPanel` dentro do `BUReportCenter`.

## 2. Layout da tela

```text
┌──────────────────────────────────────────────────────────────┐
│ Daily View · Ontem (qua, 24/06)        [Trocar data ▾]      │
│ Squad Incorporador · X SDRs · Y Closers avaliados            │
├──────────────────────────────────────────────────────────────┤
│  Cards-resumo (4):                                           │
│  ▸ Meta SDR de agendamentos: 42 / 48  (87%)                  │
│  ▸ SDRs que bateram: 6 de 9                                  │
│  ▸ Reuniões realizadas (Closer): 11 / 14  (78%)              │
│  ▸ Contratos pagos: 3 / 5                                    │
├──────────────────────────────────────────────────────────────┤
│  Abas: [ SDRs ]  [ Closers ]                                 │
│                                                              │
│  Tab SDRs — grid de cards por pessoa                         │
│   ┌──────────────────────┐  ┌──────────────────────┐         │
│   │ ● Carol Correa       │  │ ○ Cleyton Lima       │         │
│   │ Meta: 5  Feito: 7    │  │ Meta: 5  Feito: 3    │         │
│   │ ████████ 140%        │  │ ████░░░░ 60%         │         │
│   │ [Bateu] verde-lima   │  │ [Faltou 2] vermelho  │         │
│   │ "Ver detalhes →"     │  │ "Ver detalhes →"     │         │
│   └──────────────────────┘  └──────────────────────┘         │
│                                                              │
│  Tab Closers — mesma estrutura com 2 KPIs por card:          │
│   Reuniões realizadas (meta) | Contratos pagos (meta)        │
└──────────────────────────────────────────────────────────────┘
```

Clique no card → abre `SdrDailyDrilldownDialog` ou `CloserDailyDrilldownDialog`.

### Drilldown SDR (Dialog grande)
- **Header**: nome, foto/avatar, meta x realizado de ontem, badge bateu/não bateu.
- **Bloco 1 — Ligações (ontem + últimos 7 dias)**: tabela compacta com colunas `Data | Tentativas | Conexões efetivas | Qualificadas | Tempo total`. Reaproveita o RPC já existente atrás de `useSdrCallsByLead` agregando por dia.
- **Bloco 2 — Leads agendados ontem**: lista com `Lead | Telefone | Closer | Origem (Tag)`. Tag colorida: **ANAMNESE** (azul), **PLANILHA** (roxo), **A010** (verde-lima), **OUTROS** (cinza). Classificação reusa `src/lib/channelClassifier.ts`.

### Drilldown Closer (Dialog grande)
- Header com meta de reuniões e meta de contratos.
- **Reuniões realizadas ontem**: tabela `Lead | Horário | Status | Tag de origem`.
- **Contratos pagos ontem**: tabela `Lead | Produto | Valor | Data pagamento`.

## 3. Dados e RPCs

### RPC novo: `get_daily_view_incorporador(p_date date)`
Retorna JSON consolidado para uma data (default = ontem útil, calculado no client):

```json
{
  "reference_date": "2026-06-24",
  "sdrs": [
    { "sdr_id": "...", "name": "...", "email": "...",
      "meta_diaria": 5, "agendamentos": 7, "bateu": true }
  ],
  "closers": [
    { "closer_id": "...", "name": "...", "email": "...",
      "meta_reunioes": 2, "reunioes_realizadas": 3,
      "meta_contratos": 1, "contratos_pagos": 0 }
  ]
}
```

Regras:
- **SDRs**: somente quem estava no squad `incorporador` na data (usa `sdr_squad_history` quando existir, fallback `sdr.squad`). `meta_diaria` vem direto de `sdr.meta_diaria`. `agendamentos` = reuniões R1 agendadas pelo SDR cuja `scheduled_at` cai na data (mesma lógica de `get_sdr_metrics_from_agenda`).
- **Closers**: somente closers ativos com `bu='incorporador'`. `reunioes_realizadas` = `meeting_slot_attendees.status IN ('completed','contract_paid','refunded')` excluindo outsides, no `meeting_slots.scheduled_at` da data. `contratos_pagos` = transações pagas naquele dia atribuídas ao closer (mesma regra de `useCloserAgendaMetrics`, recortada para 1 dia). Metas diárias do closer derivadas de `cargo_metricas_config` (nome_metrica `reunioes_realizadas` e `contratos_pagos`) / dias úteis do mês; quando não houver registro, mostrar "—".

### Drilldown SDR
- **Ligações por dia**: novo RPC `get_sdr_call_daily_summary(p_sdr_id uuid, p_start date, p_end date)` retornando `{ day, attempts, effective, qualified, total_seconds }` agregando `calls` por SDR. Janela = últimos 7 dias terminando em `reference_date`.
- **Leads agendados ontem**: reaproveita `meeting_slot_attendees` filtrando por `booked_by_email = sdr.email` + data. Tag é calculada em JS com `channelClassifier` baseando-se nas tags do lead.

### Drilldown Closer
- Lista de reuniões: query direta em `meeting_slots` + `meeting_slot_attendees` no dia.
- Lista de contratos: query em `hubla_transactions` filtrando pelo closer atribuído no dia.

## 4. Arquivos a criar/alterar

Frontend:
- `src/pages/bu-incorporador/Relatorios.tsx` — incluir `daily_view`.
- `src/components/relatorios/ReportTypeSelector.tsx` — adicionar opção com ícone `CalendarCheck`.
- `src/components/relatorios/BUReportCenter.tsx` — render do novo painel.
- `src/components/relatorios/DailyViewPanel.tsx` (novo) — layout principal.
- `src/components/relatorios/daily-view/DailySummaryCards.tsx` (novo).
- `src/components/relatorios/daily-view/SdrDailyCard.tsx` (novo).
- `src/components/relatorios/daily-view/CloserDailyCard.tsx` (novo).
- `src/components/relatorios/daily-view/SdrDailyDrilldownDialog.tsx` (novo).
- `src/components/relatorios/daily-view/CloserDailyDrilldownDialog.tsx` (novo).
- `src/hooks/useDailyViewIncorporador.ts` (novo) — chama o RPC consolidado.
- `src/hooks/useSdrCallDailySummary.ts` (novo) — RPC de 7 dias.

Backend (migration):
- RPC `get_daily_view_incorporador(p_date date)` (security definer, leitura).
- RPC `get_sdr_call_daily_summary(p_sdr_id uuid, p_start date, p_end date)`.
- Grants `EXECUTE` para `authenticated`.

## 5. Design system

- Fonte títulos: **Space Grotesk**; corpo: **Inter** (já no projeto).
- Cards: `rounded-2xl border border-border bg-card/60 backdrop-blur` com sombra suave; barra de progresso usando `bg-primary` (verde-lima) quando bateu, `bg-destructive` quando faltou >20%, `bg-amber-500` quando faltou ≤20%.
- Badges: pill com `ring-1 ring-primary/40` para "Bateu meta"; `ring-destructive/40` para "Faltou".
- Avatares circulares com inicial em `bg-primary/15 text-primary`.
- Hover do card: `translate-y-[-2px] shadow-[0_0_24px_-8px_hsl(var(--primary)/0.4)]`.
- Sem cores fixas em Tailwind (`text-white`, `bg-black`); somente tokens semânticos.

## 6. Fora de escopo

- Edição de meta diária na tela (já existe em RH/Comp Plan).
- Exportação CSV/PDF (pode entrar em iteração futura).
- Outras BUs (este painel é exclusivo de Incorporador, conforme pedido).
