# Status atual do funil de automação WhatsApp (API oficial)

## O que já está pronto

**Infraestrutura Twilio Content API (oficial Meta)**
- Secrets configurados: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_API_KEY_*`
- Edge function `twilio-content-manage` (list / create / submit / status / delete_remote)
- Edge function `twilio-whatsapp-send` (envio com `ContentSid` + `ContentVariables`)
- Edge function `twilio-status-webhook` (callback de status de mensagem)

**Aprovação de templates pelo próprio sistema** ✅
- Tabela `automation_templates` com `approval_status`, `twilio_template_sid`, `approval_rejected_reason`, `buttons_config`, `category`, `language`, `business_units`
- `TemplateEditorDialog` mostra "Status Meta" + botões **Criar no Twilio / Submeter à Meta / Refresh**
- Conteúdo trava (`isLocked`) quando aprovado (regra da Meta)
- Hoje há **1 template** criado e **aprovado**: "Boa Vindas"

**Motor de fluxos**
- Tabelas: `automation_flows`, `automation_steps`, `automation_queue`, `automation_logs`, `automation_blacklist`, `automation_routing_rules`, `automation_settings`
- Trigger `trg_automation_enqueue` em `crm_deals` (enfileira ao mover de stage)
- Edge function `automation-enqueue` (entrada) e `automation-processor` (despacho)
- UI completa em `/admin/automacoes`: Fluxos, Cross-Pipeline, Templates, Webhooks IN/OUT, Lembretes, Logs, Configurações

## O que falta para fechar (3 bloqueios)

### 1. Cron do `automation-processor` NÃO está agendado
`SELECT * FROM cron.job` não retorna nada para automation-processor. Sem isso a fila enche e nada sai. A `AutomationSettings` mostra o SQL mas ele nunca foi executado.

**Ação:** rodar via migration:
```sql
select cron.schedule(
  'process-automation-queue',
  '*/5 * * * *',
  $$ select net.http_post(
    url := '.../automation-processor',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon>"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);
```

### 2. Webhook de status de template (Twilio → nosso sistema)
Hoje o status Meta só atualiza quando alguém clica **Refresh** no editor. Para virar automático ao Meta aprovar/rejeitar:
- Confirmar no painel Twilio Content Editor que o callback aponta para `twilio-status-webhook` (ou criar handler `twilio-content-status-webhook` se o existente só cobre status de mensagem enviada)
- Alternativa simples: rodar `twilio-content-status-poll` a cada 30min via cron para varrer templates `pending` e atualizar

### 3. Nenhum fluxo nem passo criado ainda
- `automation_flows`: 0
- `automation_steps`: 0

Ou seja, mesmo com o template "Boa Vindas" aprovado, nada dispara porque não existe um Fluxo (stage gatilho + passo apontando para o template).

**Ação UX:** entrar em `/admin/automacoes` → Fluxos → "Novo Fluxo", escolher stage/origem, adicionar passo com o template "Boa Vindas".

## Roteiro proposto (ordem de execução)

1. **Migration** que agenda o cron do `automation-processor` (5 min) e do `twilio-content-status-poll` (30 min) — desbloqueia disparo automático e atualização de aprovação sem refresh manual
2. **Validar** que `twilio-status-webhook` cobre status de template; se não cobrir, criar handler dedicado para o callback de aprovação Meta
3. **Criar o primeiro fluxo real** ligado à stage que você quiser disparar (ex: "Lead novo" → "Boa Vindas") como caso de teste end-to-end
4. **Smoke test:** mover um deal de teste para a stage → ver entrada em `automation_queue` → cron processa → `automation_logs` mostra `sent` → mensagem chega no WhatsApp

## Pequenas melhorias paralelas (opcional)

- Mostrar contagem da fila e last_run do processor no `AutomationMetrics`
- Botão "Forçar processamento agora" em Configurações chamando `automation-processor` direto
- Banner amarelo em `/admin/automacoes` quando `cron.job` não tiver o job agendado

Confirma que quer seguir por aí (cron + 1º fluxo) ou prefere começar pelo polling/webhook de aprovação?
