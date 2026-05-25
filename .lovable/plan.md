## Findings tratados

### Banco de dados (migration já enviada para aprovação)
- `lead_profiles`: remove policy pública redundante "Service role full access"
- `automation_blacklist`: INSERT só para `authenticated`
- `daily_costs`: INSERT só para `authenticated`
- `profiles`: policy do TV dashboard passa a exigir `authenticated` (não expõe mais email para anônimos)
- `whatsapp_instances`: SELECT restrito apenas a `admin` (remove leitura geral de tokens)
- `r2_status_options` e `r2_thermometer_options`: INSERT/UPDATE/DELETE só para `authenticated`

### Edge functions (código)
1. `kiwify-webhook-handler`: validar token deny-by-default — retorna 500 se `KIWIFY_WEBHOOK_TOKEN` não configurado, 401 se token ausente/incorreto (hoje aceita request sem token).
2. `twilio-token`: exigir `Authorization: Bearer` válido via `supabase.auth.getClaims()`; forçar `identity = claims.sub` (impede minting de tokens para outras identidades).
3. `twilio-whatsapp-send`: exigir `Authorization: Bearer` válido antes de enviar qualquer mensagem.
4. `twilio-voice-webhook`, `twilio-whatsapp-webhook`, `twilio-status-webhook`, `twilio-voice-twiml`: adicionar validação `X-Twilio-Signature` (HMAC-SHA1 do URL + params usando `TWILIO_AUTH_TOKEN`). Helper inline em cada função; retorna 403 se inválido. Quando `TWILIO_AUTH_TOKEN` não configurado → 500.

### Frontend (XSS)
- `src/components/crm/TaskDetailPanel.tsx`: substituir `dangerouslySetInnerHTML` na função `renderMarkdown` por renderização segura. Plano: escapar HTML do texto **antes** de aplicar o regex `**bold**`, e renderizar `<strong>` via JSX/`<React.Fragment>` em vez de injetar HTML. Sem dependência nova.

## Findings não acionáveis automaticamente (informativos)
- `consorcio_pending_registrations_sensitive_pii` e `outbound_webhook_configs_secret_token_exposure`: scanner já reconhece que policies estão corretas — vou marcar como ignored com justificativa.
- `realtime_messages_no_channel_authorization`: requer configurar Realtime Authorization no painel (não-trivial, fora do escopo automático) — vou deixar nota e marcar para revisão manual.
- Linter Supabase (`function_search_path_mutable`, `security_definer_view`, `extension_in_public`, `materialized_view_in_api`, `auth_leaked_password_protection`, `rls_policy_always_true`, `*_security_definer_function_executable`): warnings genéricos do projeto com dezenas de funções/views legadas. Não vou tocar nesses agora — exigem revisão caso a caso. Vou listar para você no fim.

## Sequência
1. Você aprova a **migration** (já enviada) — corrige 7 findings de RLS.
2. Você aprova este **plano** → eu aplico os 5 patches em edge functions + 1 no `TaskDetailPanel.tsx`.
3. Marco findings resolvidos no scanner e atualizo `@security-memory`.
