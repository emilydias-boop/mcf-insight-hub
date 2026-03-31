

## Auditoria do Fluxo de Entrada de Leads na Pipeline

Após análise completa do fluxo de entrada de leads (webhook → criação de deal → exibição no Kanban → drawer de detalhes), identifiquei os seguintes problemas:

---

### Problema 1 (CRÍTICO): Deduplicação de contrato pago quebrada — coluna errada
**Arquivo**: `supabase/functions/webhook-lead-receiver/index.ts` (linhas 919-923)

A função `getContractPaidStageIds` busca em `crm_stages` usando `.ilike('name', '%contrato%pago%')`, mas a coluna correta é `stage_name`. O campo `name` não existe na tabela `crm_stages`.

Resultado: a query retorna array vazio, e o filtro de deduplicação que deveria bloquear leads que já pagaram contrato **nunca funciona**. Leads com contrato pago podem receber novos deals duplicados via webhook.

Todos os outros Edge Functions (hubla-webhook-handler, webhook-make-contrato) usam `stage_name` corretamente.

**Correção**: Trocar `.ilike('name', '%contrato%pago%')` por `.ilike('stage_name', '%contrato%pago%')` na linha 923.

---

### Problema 2: Formulário manual não verifica duplicatas
**Arquivo**: `src/components/crm/DealFormDialog.tsx` (linhas 146-200)

Ao criar um negócio manualmente via "Novo Negócio", o formulário cria contato + deal sem verificar se já existe um contato com mesmo email/telefone ou um deal na mesma pipeline. Isso pode gerar duplicatas quando o gestor cria um deal para um lead que já entrou via webhook.

**Correção**: Antes de criar, buscar contato existente por email/telefone e verificar se já existe deal na mesma origin. Se existir, reusar o contato e alertar sobre deal duplicado.

---

### Problema 3: Notificações de novo lead só para SDRs
**Arquivo**: `src/hooks/useNewLeadNotifications.ts` (linha 18)

O hook `useNewLeadNotifications` só ativa para `isSdrRole(role)`. Gestores e admins (que estão na tela do Kanban) não recebem notificação em tempo real de novos leads. O Kanban não atualiza automaticamente para eles.

**Correção**: Remover a restrição de role ou adicionar roles de gestão, e garantir que o `queryClient.invalidateQueries` rode para manter o Kanban atualizado.

---

### Problema 4: Drawer já corrigido para usar UUID
O `DealDetailsDrawer` agora passa `deal.id` (UUID) tanto para `LeadFullTimeline` quanto para `DealHistory`. Isso está correto após a correção anterior. Sem ação necessária.

---

### Problema 5: Webhook não valida stage_id contra crm_stages corretamente
**Arquivo**: `supabase/functions/webhook-lead-receiver/index.ts` (linhas 106-152)

O webhook primeiro busca em `crm_stages`, depois em `local_pipeline_stages`. Se o `endpoint.stage_id` aponta para `local_pipeline_stages`, o webhook tenta buscar em `crm_stages` primeiro (falha), depois faz fallback para `local_pipeline_stages` buscando pelo `origin_id` (primeira stage ativa) — mas isso pode retornar uma stage diferente da configurada. O stage_id do endpoint pode ser ignorado silenciosamente.

**Ação**: Menor prioridade — funciona na prática porque a maioria dos endpoints usa `crm_stages`.

---

## Plano de Correções

### Fase 1 — Bug crítico de dados
1. **Corrigir coluna na deduplicação** — Trocar `name` por `stage_name` em `getContractPaidStageIds` no `webhook-lead-receiver`

### Fase 2 — Integridade de dados
2. **Deduplicação no formulário manual** — Verificar contato existente antes de criar novo em `DealFormDialog.tsx`

### Fase 3 — UX
3. **Notificações para gestores** — Expandir `useNewLeadNotifications` para incluir admin/manager

### Arquivos afetados
- `supabase/functions/webhook-lead-receiver/index.ts` — Corrigir coluna `name` → `stage_name`
- `src/components/crm/DealFormDialog.tsx` — Adicionar verificação de duplicatas
- `src/hooks/useNewLeadNotifications.ts` — Remover restrição de role SDR

