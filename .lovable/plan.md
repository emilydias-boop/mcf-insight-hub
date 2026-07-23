# Boas-vindas R2 via Template Meta (usando o gestor de templates do próprio app)

## Correção do plano anterior
Você **não precisa** criar o template manualmente no Console do Twilio. O app já tem um gestor completo de templates HSM em **Administração → Automações → Templates** (`TemplateEditorDialog`, tabela `automation_templates`, edge function `twilio-content-manage`, hooks `useCreateTwilioContent` / `useSubmitTwilioContent` / `useSyncAllTwilioStatus`). Ele cria o template no Twilio, submete para aprovação Meta e guarda o `twilio_content_sid` no banco automaticamente. Vamos usar esse fluxo — sem secret manual, sem passo fora do app.

## Passo 1 — Criar o template dentro do app (você faz na UI, sem código)

Em **Administração → Automações → Templates → Novo template**:

- Nome: `boas_vindas_r2_contrato_pago`
- Idioma: `pt_BR`
- Canal: WhatsApp
- Categoria Meta: `MARKETING` (se reprovar, ressubmeter como `UTILITY`)
- Variáveis: `nome` (a UI converte para `{{1}}` na Twilio)
- Corpo:

```
Olá, {{nome}}! 🎉

Parabéns pela decisão — seu contrato foi confirmado e você agora faz parte da Seleção MCF.

SEUS PRÓXIMOS PASSOS — O que fazer agora:

1) Acesse o conteúdo na MCF Pay
Lá estão os detalhes do contrato e a explicação completa do nosso modelo de negócio (Acesso no seu email).

2) Agende sua reunião de seleção
O passo que garante sua vaga. É a reunião com um sócio da MCF — sem ela, você não avança.

3) Entre no grupo dos selecionados
No mesmo contato acima você recebe informações sobre a abertura das vagas e a reunião com a equipe.

Qualquer dúvida, é só chamar por aqui. Nos vemos na R2! 🚀
```

- Botão (Call to Action):
  - Tipo: URL
  - Rótulo: `Agendar R2`
  - URL: `https://hi.switchy.io/x9NB` (estática — sem variável, evita reprovação Meta)

- Clicar **Criar no Twilio** → salva `twilio_content_sid` no `automation_templates`.
- Clicar **Enviar para aprovação Meta** → status vai para `pending`; o poller (`twilio-content-status-poll`) atualiza para `approved` quando a Meta aprovar.

## Passo 2 — Ligar o flow "Boas-vindas R2 (Contrato Pago)" a esse template

Hoje `automation_flows` para `system_event` guarda `body_template` inline (texto livre). Para usar um HSM aprovado, o flow precisa referenciar o `automation_templates.id`.

- **Migração**: adicionar coluna `template_id uuid null references automation_templates(id) on delete set null` em `automation_flows` (mais um índice). Nenhum backfill: flows existentes continuam funcionando com `body_template`.
- **UI** (`FlowEditorDialog.tsx`): quando `trigger_type = 'system_event'` **e** o canal inclui WhatsApp, mostrar um seletor "Template WhatsApp (Meta-aprovado)" listando templates com `channel = 'whatsapp'`, exibindo o status de aprovação (`draft`/`pending`/`approved`/`rejected`). Bloquear salvar/ativar o flow se o template selecionado não estiver `approved` (com mensagem clara). Manter `body_template` como fallback opcional só para e-mail.
- No card do flow (`FlowList`): badge "Template Meta: `boas_vindas_r2_contrato_pago` (aprovado)".

## Passo 3 — Dispatcher usa `ContentSid` quando há template linkado

Em `supabase/functions/automation-event-dispatcher/index.ts`:

- Ao carregar o flow, incluir join com `automation_templates` (id, name, twilio_content_sid, approval_status, variables).
- No ramo WhatsApp:
  - Se o flow tem `template_id` e o template está `approved` com `twilio_content_sid`: chamar `twilio-whatsapp-send` com:
    - `templateSid: template.twilio_content_sid`
    - `contentVariables: { "1": ctx.nome }` (ordem = ordem de `template.variables`; hoje só temos `nome`)
  - Se o template estiver linkado mas **não** aprovado: **não** cair no envio freeform — logar erro `template_not_approved` no `automation_run_logs` e pular.
  - Se o flow não tem `template_id` (comportamento legado): manter envio freeform atual (só funciona dentro da janela 24h).
- Manter idempotência (`boas_vindas_r2_whatsapp_enviado_em`) e o trigger `trg_notify_attendee_contract_paid`.
- Logar códigos Twilio 63016 (fora da janela) e 63051 (template não aprovado) com detalhe.

## Passo 4 — Memory

Registrar regra: disparos WhatsApp fora da janela de 24h devem usar template `automation_templates` com `approval_status = 'approved'` e `twilio_content_sid`, referenciado pelo `automation_flows.template_id`. Envio freeform (`Body`) só é permitido para flows sem `template_id` e dentro da janela.

## Detalhes técnicos

Arquivos afetados:
- Nova migração: `automation_flows.template_id` (FK opcional para `automation_templates`).
- `src/hooks/useAutomationFlows.ts` — incluir/gravar `template_id`, join com template.
- `src/components/automations/FlowEditorDialog.tsx` — seletor de template WhatsApp para eventos do sistema, com status de aprovação.
- `src/components/automations/FlowList.tsx` — badge do template no card.
- `supabase/functions/automation-event-dispatcher/index.ts` — enviar via `templateSid`/`contentVariables` quando houver template linkado; nunca cair em freeform quando o template está definido mas não aprovado.

Sem novo secret. Sem alteração no `twilio-whatsapp-send` (já suporta `templateSid` + `contentVariables`).
