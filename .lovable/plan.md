
Contexto do erro
- O toast/console mostra:
  - code: 23503
  - message: viola FK "webhook_endpoints_stage_id_fkey"
  - details: Key is not present in table "local_pipeline_stages"
- Ou seja: o formulário está enviando um stage_id que não existe em local_pipeline_stages.
- Hoje o modal “Novo Webhook de Entrada” (IncomingWebhookFormDialog) busca etapas na tabela errada (crm_stages) e usa esses IDs no insert de webhook_endpoints.
- Porém a FK de webhook_endpoints.stage_id aponta para local_pipeline_stages (confirmado em src/integrations/supabase/types.ts).

Objetivo
- Permitir criar webhook de entrada em qualquer pipeline (origin) sem erro de FK, usando corretamente as etapas da pipeline (local_pipeline_stages).

Causa raiz (código atual)
Arquivo: src/components/crm/webhooks/IncomingWebhookFormDialog.tsx
- Fetch de stages:
  - from('crm_stages').select('id, stage_name, stage_order').eq('origin_id', originId)
- Dropdown usa stage.stage_name e envia stage.id
- Na hora de criar webhook_endpoints, esse stage.id (de crm_stages) vai para stage_id, mas o banco exige que stage_id exista em local_pipeline_stages.

Solução proposta (ajuste no frontend)
1) Trocar a fonte de “Etapa Inicial” de crm_stages para local_pipeline_stages
- Alterar o useQuery de stages para:
  - from('local_pipeline_stages')
  - select('id, name, stage_order, is_active')
  - eq('origin_id', originId)
  - eq('is_active', true)
  - order('stage_order')
- Atualizar o render do SelectItem para mostrar stage.name (em vez de stage.stage_name)

2) Ajustar defaults e validação do stage_id no formulário
- Hoje o default stage_id tenta usar stages?.[0]?.id (mas stages eram de crm_stages).
- Manter a mesma lógica, mas agora com local_pipeline_stages:
  - ao abrir modal em modo “novo”, setar stage_id = firstStageId (se existir) senão ''/undefined.
- Garantir que ao enviar para createMutation:
  - stage_id seja null quando vazio (para evitar enviar string vazia)
  - Observação: o hook useCreateWebhookEndpoint já converte para null usando `stage_id: endpoint.stage_id || null`, mas vamos garantir também no onSubmit para consistência.

3) UX de segurança (quando pipeline não tem etapas ativas)
- Se stages vier vazio:
  - Exibir mensagem no campo “Etapa Inicial”: “Esta pipeline não possui etapas ativas. Crie uma etapa antes de configurar o webhook.”
  - Desabilitar o botão “Criar Webhook” (ou permitir criar com stage_id null, dependendo da regra do produto).
  - Recomendo: permitir salvar com stage_id null apenas se o receptor de leads suportar fallback para “primeira etapa da pipeline”. Se não existir fallback, bloquear criação para evitar leads “sem etapa”.

4) Conferir consistência com o restante do sistema
- O Wizard de pipeline já cria etapas em local_pipeline_stages e, quando cria webhook automaticamente, ele já mapeia IDs temporários -> IDs de local_pipeline_stages (useCreatePipeline.ts). Isso confirma que o padrão correto é local_pipeline_stages.
- Após a correção do modal, a criação manual de webhook vai ficar alinhada com o Wizard.

Plano de testes (manual, rápido)
1) Abrir /crm/negocios
2) Ir em Configurações da Pipeline A (onde antes falhava)
3) Webhooks de Entrada → Novo Webhook
4) Selecionar “Etapa Inicial” e criar
   - Esperado: criar sem toast de FK
5) Repetir em outra pipeline (origin) diferente
6) Confirmar no Supabase (tabela webhook_endpoints) que:
   - origin_id = pipeline selecionada
   - stage_id = id existente em local_pipeline_stages
7) Enviar um POST de teste para o endpoint criado (quando aplicável) e confirmar que o lead cai na etapa correta

Arquivos a alterar
- src/components/crm/webhooks/IncomingWebhookFormDialog.tsx
  - trocar query de stages para local_pipeline_stages
  - ajustar campos exibidos (name)
  - reforçar stage_id null quando vazio
  - tratar caso sem etapas

Risco/impacto
- Baixo: mudança localizada no modal de criação/edição do webhook.
- Impacto positivo imediato: desbloqueia criação de webhook em qualquer pipeline e elimina o erro de FK.

Observação importante
- Se ainda existir alguma pipeline “antiga” que use crm_stages (legado) e não tenha local_pipeline_stages, ela continuará sem etapas no dropdown. Nesse caso, a correção certa é migrar/garantir etapas em local_pipeline_stages (mas primeiro vamos validar se isso ocorre no seu ambiente).
