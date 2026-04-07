

# Rastrear autoria nas atividades e mostrar fonte do webhook na timeline

## Problema
1. **Eventos de entrada** ("Entrada: PIPELINE INSIDE SALES") nao mostram que veio do webhook de anamnese — a info existe no `deal_activities` (`lead_entered` com metadata `endpoint_name`) mas o hook ignora esse tipo de atividade, gerando apenas um evento sintetico generico.
2. **Mudancas de estagio** nao mostram quem fez — o `user_id` e `null` em quase todos os inserts de `deal_activities` feitos via Agenda, Qualificacao, Cockpit, etc. Apenas `next_action_scheduled/completed` passam `user_id`.
3. **Ligacoes** ja mostram o autor corretamente (calls.user_id e preenchido).

## Solucao

### Etapa 1: Timeline — processar `lead_entered` com dados do webhook
No hook `useLeadFullTimeline.ts`, o bloco que processa `deal_activities` ignora `lead_entered` e depois cria um evento sintetico generico. Corrigir para:
- Reconhecer `activity_type = 'lead_entered'` e gerar um evento `entry` com titulo mostrando a fonte (ex: "Entrada via ClientData Inside — PIPELINE INSIDE SALES")
- Incluir metadata do webhook (endpoint_name, endpoint_slug, source) no evento
- Evitar duplicata: o bloco sintetico ja verifica se existe evento `entry` proximo ao `created_at` — com o `lead_entered` processado, nao criara duplicata

### Etapa 2: Passar `user_id` (auth.uid) em todos os inserts de deal_activities feitos no frontend
Arquivos que inserem em `deal_activities` sem `user_id`:
- `src/hooks/useAgendaData.ts` — status updates da Agenda (stage_change)
- `src/hooks/useQualification.ts` — qualificacao (stage_change)
- `src/hooks/useCloserScheduling.ts` — agendamento de reuniao
- `src/hooks/useDealTasks.ts` — conclusao de tarefa
- `src/hooks/useLimboLeads.ts` — criacao/replicacao de leads
- `src/components/sdr/cockpit/CockpitExecutionPanel.tsx` — resultado de ligacao
- `src/components/crm/PostCallModal.tsx` — pos-ligacao

Em cada um, adicionar `const { data: { user } } = await supabase.auth.getUser()` e incluir `user_id: user?.id` no insert.

### Etapa 3: Timeline — melhorar exibicao do autor em stage_change
O `resolveAuthor` para stage_change ja tenta `meta.owner_email` e `meta.changed_by`. Com o `user_id` agora preenchido, o sistema de resolucao via `profileMap` passara a funcionar automaticamente.

Para mudancas automaticas (webhooks, sync), adicionar `changed_by_name` na metadata onde possivel (ex: agenda sync pode incluir `changed_by: user.email`).

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useLeadFullTimeline.ts` | Processar `lead_entered` como evento `entry` com info do webhook |
| `src/hooks/useAgendaData.ts` | Adicionar `user_id` nos inserts de deal_activities |
| `src/hooks/useQualification.ts` | Adicionar `user_id` no insert |
| `src/hooks/useCloserScheduling.ts` | Adicionar `user_id` no insert |
| `src/hooks/useDealTasks.ts` | Adicionar `user_id` no insert |
| `src/hooks/useLimboLeads.ts` | Adicionar `user_id` nos inserts |
| `src/components/sdr/cockpit/CockpitExecutionPanel.tsx` | Adicionar `user_id` no insert (ja busca user, so precisa passar) |
| `src/components/crm/PostCallModal.tsx` | Adicionar `user_id` no insert |

