

## Plano: Central de Análise de Webhooks + Exportação PDF

### Contexto

O usuário quer uma tela para drill-down nos leads recebidos por cada webhook endpoint (ex: os 57 leads de "ClientData Inside"), com KPIs, tabela detalhada, e exportação PDF no mesmo estilo do relatório de backfill A010.

### Arquitetura

```text
/crm/webhook-analytics (nova aba no CRM)
┌──────────────────────────────────────────────────┐
│ [Seletor Endpoint ▼]  [Período]  [Exportar PDF]  │
├──────────────────────────────────────────────────┤
│ KPIs: Recebidos | Com Dono | Avançaram | R1 Ag.  │
├──────────────────────────────────────────────────┤
│ Breakdown por Estágio (badges com contadores)     │
├──────────────────────────────────────────────────┤
│ Tabela: Nome|Telefone|Email|Estágio|Dono|Data    │
│ [Busca] [Filtro estágio] [Filtro dono]           │
└──────────────────────────────────────────────────┘
```

### Implementação

#### 1. Hook `src/hooks/useWebhookIntakeAnalytics.ts`
- Query `crm_deals` onde `data_source='webhook'` e `custom_fields->>'lead_channel'` = slug selecionado
- Join com `crm_contacts`, `crm_stages`/`local_pipeline_stages`, `profiles` (owner)
- Filtro por período (created_at)
- Calcula KPIs: total, com dono, taxa de avanço por estágio, contagem por estágio

#### 2. Componente `src/components/crm/webhooks/WebhookIntakeAnalytics.tsx`
- Seletor de endpoint (usa `useWebhookEndpoints` existente)
- DateRangePicker para período
- Cards KPI no topo
- Breakdown visual por estágio (badges coloridos)
- Tabela com busca, filtros por estágio/dono
- Botão "Exportar PDF"

#### 3. Geração de PDF (client-side com jsPDF + jspdf-autotable)
- Mesmo estilo visual do relatório backfill: seções numeradas, tabelas formatadas
- Seções:
  1. Resumo Executivo — endpoint, período, totais
  2. KPIs consolidados — tabela com métricas
  3. Breakdown por estágio — tabela com contagem e %
  4. Lista completa de leads — nome, telefone, email, estágio, dono, data entrada
- Gera e baixa PDF direto no navegador

#### 4. Página `src/pages/crm/WebhookAnalytics.tsx`
- Wrapper simples que renderiza o componente principal

#### 5. Rota e navegação
- Adicionar rota `/crm/webhook-analytics` no `App.tsx`
- Adicionar aba "Webhooks" no nav do `CRM.tsx` (com icon `Inbox` ou `Webhook`)

### Dependência
- Instalar `jspdf` e `jspdf-autotable` para geração PDF client-side

### Arquivos criados/modificados
| Arquivo | Ação |
|---------|------|
| `src/hooks/useWebhookIntakeAnalytics.ts` | Criar |
| `src/components/crm/webhooks/WebhookIntakeAnalytics.tsx` | Criar |
| `src/pages/crm/WebhookAnalytics.tsx` | Criar |
| `src/App.tsx` | Adicionar rota |
| `src/pages/CRM.tsx` | Adicionar aba nav |

### Resultado
O usuário poderá selecionar qualquer webhook endpoint, ver KPIs + tabela de todos os leads que entraram, filtrar por período/estágio/dono, e gerar PDF formatado igual ao relatório de backfill para compartilhar.

