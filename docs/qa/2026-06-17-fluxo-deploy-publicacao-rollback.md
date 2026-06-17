# Fluxo de Deploy, Publicação e Rollback — Features Recentes

## Metadados
- **Data:** 2026-06-17
- **Solicitante:** thobson.motta@minhacasafinanciada.com
- **Módulo:** Operação / Release Management
- **Status:** Playbook ativo
- **Audiência:** Owner e editores do projeto

## Objetivo
Padronizar como publicar as features recentes (export PDF da Documentação QA, transcrição IA Twilio + Gemini, e o hardening de RLS quando aprovado) garantindo (1) que o que já funciona continue funcionando, (2) que cada deploy tenha um ponto de restauração claro, e (3) que rollback seja executável em minutos.

## Conceitos-chave

| Camada | Como muda | Como volta |
|---|---|---|
| **Frontend (React/Vite)** | Vai ao ar somente após **Publish → Update** | Revert pelo histórico do chat ou aba **History** do Lovable |
| **Edge Functions (Supabase)** | Deploy **imediato e automático** ao salvar | Re-deploy de versão anterior via revert do código + redeploy |
| **Migrations / RLS** | Aplicadas só após aprovação explícita | Nova migration revertendo o estado (forward-only) |
| **Secrets** | Imediato | `update_secret` / `delete_secret` |
| **Twilio Console** | Manual | Reverter webhook/idioma manualmente |

> Frontend exige clique em **Update** no diálogo de Publish. Backend (edge functions, migrations) vai ao ar sozinho — por isso o ponto de restauração precisa ser criado **antes** de salvar mudanças sensíveis.

## Pré-deploy (checklist obrigatório)

1. **Marcar ponto de restauração**
   - No chat, anotar o ID/mensagem da última versão estável (botão *Revert* fica visível em cada mensagem do AI).
   - Abrir aba **History** e confirmar que a versão atual está listada.
   - Para banco: anotar a última migration aplicada e exportar via CSV as tabelas críticas (`calls`, `crm_deals`, `attendee_notes`, `deal_activities`, `profiles`, `user_roles`).
2. **Rodar scan de segurança** antes de Publish (bloqueia em findings críticos não resolvidos).
3. **Smoke test em preview** das rotas afetadas:
   - `/admin/documentacao-qa` (lista, seleção, **Exportar PDF**)
   - `/crm/*` lead com chamada recente (tab **Notas** mostra `ai_call_summary`)
   - Login + role guard (`ResourceGuard`/`RoleGuard`)
4. **Validar Edge Function logs** sem erros recentes:
   - `twilio-voice-webhook`
   - `twilio-transcript-callback`
5. **Validar secrets configurados**: `TWILIO_*`, `TWILIO_VOICE_INTELLIGENCE_SERVICE_SID`, `LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Sequência de deploy por feature

### A) Export PDF (`/admin/documentacao-qa`) — Frontend puro
1. Confirmar build verde (sem erros TS/Vite).
2. Smoke test em preview: exportar 1 doc curto e 1 longo.
3. **Publish → Update**.
4. Validar no domínio publicado.
5. **Rollback:** Revert do chat na mensagem anterior + Publish → Update novamente.

### B) Transcrição IA Twilio + Gemini — Backend + Frontend
1. **Banco/edge functions já estão no ar** (deploy automático). Verificar `Edge Function logs`.
2. Configurar manualmente no Twilio Console:
   - Voice Intelligence > Service: webhook `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/twilio-transcript-callback`
   - Evento `transcript.completed` habilitado
   - Idioma `pt-BR`
3. Smoke test: ligação real ≥ 90s → checar 4 destinos (`calls.ai_summary`, `crm_deals.custom_fields.callSummaries`, `attendee_notes`, `deal_activities`).
4. Publicar frontend (DealNotesTab) com **Publish → Update**.
5. **Rollback:**
   - **Frontend:** revert + Publish → Update.
   - **Edge functions:** revert do código no chat → o salvamento redeploya automaticamente.
   - **Twilio:** desabilitar o webhook ou remover o evento `transcript.completed` no console.
   - **Dados gravados:** ficam — limpeza opcional via UPDATE direcionado (`UPDATE calls SET ai_summary = NULL WHERE created_at > 'X'`).

### C) Hardening de RLS (pendente)
1. Aplicar em **migrations menores** (1 tabela por vez) para isolar quebras.
2. Para cada migration:
   - Validar políticas em staging (preview) com usuário de cada role.
   - Confirmar que jobs/edge functions seguem inserindo (devem usar `service_role`).
   - Validar TV dashboard se mexer em `profiles`.
3. **Rollback:** nova migration restaurando políticas anteriores (forward-only — nunca editar migration já aplicada).

## Pós-deploy

1. Monitorar **Edge Function logs** por 30 min.
2. Conferir `daily_costs` 24h depois (custo IA).
3. Validar com 1 usuário real de cada role principal (admin, coordenador, closer, SDR).
4. Registrar versão estável: anotar no chat "✅ baseline estável — pos deploy YYYY-MM-DD HH:MM".

## Tratamento de erros transitórios de build

Mensagens como:
```
upload failed: dist/assets/*.js  Read timeout / InternalError ... r2.cloudflarestorage.com
```
São timeouts da infra de hospedagem da Lovable (Cloudflare R2), **não** falhas de código. Conduta:
1. Re-disparar o build (basta clicar Publish → Update novamente, ou refazer o último save).
2. Se persistir > 2 tentativas, aguardar 5 min e tentar novamente.
3. Se persistir > 15 min, escalar para suporte Lovable.
4. **Não** alterar código tentando "consertar" — o artefato local está OK.

## Matriz de rollback rápido

| Cenário | Ação imediata |
|---|---|
| Tela branca após Publish | Revert do chat na última mensagem estável → Publish → Update |
| Edge function quebrou | Revert do código da function → salva redeploya |
| RLS bloqueou usuários | Nova migration restaurando policy anterior |
| IA gerando lixo | Desabilitar webhook Twilio (Voice Intelligence) |
| Custos IA disparados | Subir threshold de duração no `twilio-voice-webhook` (ex.: 120s) e redeployar |
| Build falhando por R2 timeout | Aguardar e re-disparar Publish |

## Checklist final
- [ ] Ponto de restauração registrado (chat + History + CSVs)
- [ ] Scan de segurança sem críticos abertos
- [ ] Smoke test em preview passou
- [ ] Publish → Update executado
- [ ] Validação no domínio publicado
- [ ] Logs limpos por 30 min
- [ ] Linha "baseline estável" registrada no chat
