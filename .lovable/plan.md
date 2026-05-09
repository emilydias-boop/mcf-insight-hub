## Onda 1 — Editor de Templates Twilio (atualização sob demanda)

Continuação do plano aprovado, **sem cron**. A função `twilio-content-status-poll` já criada vira backend de um botão manual.

### O que já está pronto
- ✅ Migration aplicada em `automation_templates` (`approval_status`, `approval_submitted_at`, `approval_updated_at`, `approval_rejected_reason`, `buttons_config`, `category`, `language`, `variable_count`).
- ✅ Edge function `twilio-content-manage` (ações `list`, `create`, `submit`, `status`, `delete_remote`).
- ✅ Edge function `twilio-content-status-poll` (varre todos os `pending` de uma vez).

### O que falta nesta leva

1. **Hook `useAutomationTemplates.ts`** — incluir os novos campos no tipo `AutomationTemplate` e no insert/update.

2. **`TemplateEditorDialog.tsx`** — estender com:
   - Seletor de **Categoria** (utility / marketing / authentication) e **Idioma** (pt_BR padrão).
   - Editor de **Botões** (até 3): tipo URL ou Quick Reply, texto, URL opcional. Reordenar/remover.
   - **Badge de status** Meta (cores: cinza draft, amarelo pending, verde approved, vermelho rejected).
   - Mostrar `approval_rejected_reason` quando rejeitado.
   - Botão **"Criar no Twilio"** (chama `twilio-content-manage` action `create`) — só aparece se ainda não tem `twilio_template_sid`.
   - Botão **"Submeter à Meta"** (action `submit`) — só aparece com SID e status `draft`.
   - Botão **"Atualizar status"** (action `status`) — sempre que tiver SID, ao lado do badge.
   - Bloquear edição de `content`/`buttons_config` quando status ≠ `draft` (Meta congela conteúdo aprovado).

3. **Lista de templates (`TemplatesTab` em `/admin/automacoes`)**:
   - Coluna nova: **Status Meta** (badge).
   - Botão no header: **"Sincronizar status"** → invoca `twilio-content-status-poll`, mostra toast com X atualizados, refetch.

4. **Hook auxiliar `useTwilioContent.ts`** — wrappers `useCreateTwilioContent`, `useSubmitTwilioContent`, `useRefreshTwilioContent`, `useSyncAllTwilioStatus` (todos `useMutation` chamando `supabase.functions.invoke`).

### Fora de escopo desta leva (ondas seguintes)
- Trigger em `meeting_slots`, novo motor de cadência, flow piloto — Ondas 2 a 5.

### Validação
1. Criar template "teste_aprovacao_lovable" no CRM com 1 botão URL.
2. Clicar **Criar no Twilio** → confirma `twilio_template_sid` salvo no DB.
3. Clicar **Submeter à Meta** → status vai pra `pending`.
4. Clicar **Atualizar status** depois de algumas horas → vê `approved`/`rejected`.
5. Lista mostra badge correto; **Sincronizar status** atualiza todos os pendentes em um clique.
