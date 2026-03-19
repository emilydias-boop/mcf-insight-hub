

## Plano: Mostrar "Entrada na Pipeline" na Timeline do Lead

### Problema
A Timeline está vazia porque o `webhook-lead-receiver` não cria um registro em `deal_activities` quando o lead entra na pipeline. A "Jornada do Lead" mostra a entrada porque lê diretamente o `created_at` do deal, mas a Timeline depende de registros em `deal_activities`.

### Solução (duas frentes)

**1. Frontend — Sintetizar evento de entrada (correção imediata)**

No `src/hooks/useLeadFullTimeline.ts`:
- Adicionar uma query extra buscando os dados básicos dos deals (`crm_deals`) usando os `uniqueIds` — campos: `id`, `created_at`, `stage_id`, `origin_id`, `owner_id`
- Após processar todos os eventos, para cada deal, verificar se já existe um evento com data igual ao `created_at` do deal (tolerância de 1 minuto). Se não existir, sintetizar um evento `stage_change` com título "Entrada na Pipeline" e a data do `created_at`
- Adicionar o tipo `'entry'` ao `TimelineEventType` para distinguir visualmente

No `src/components/crm/LeadFullTimeline.tsx`:
- Adicionar config de ícone/cor para o tipo `entry` (ícone LogIn, cor verde)
- Adicionar "Entrada" nas opções de filtro

**2. Backend — Gravar atividade na criação (correção para novos leads)**

No `supabase/functions/webhook-lead-receiver/index.ts`:
- Após criar o deal com sucesso, inserir um registro em `deal_activities` com `activity_type: 'lead_entered'`, descrição com nome do endpoint/origem, e metadata com `source: 'webhook'`

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useLeadFullTimeline.ts` | Buscar `crm_deals` e sintetizar evento "Entrada na Pipeline" |
| `src/components/crm/LeadFullTimeline.tsx` | Adicionar tipo `entry` com ícone e filtro |
| `supabase/functions/webhook-lead-receiver/index.ts` | Inserir `deal_activities` com `activity_type: 'lead_entered'` ao criar deal |

