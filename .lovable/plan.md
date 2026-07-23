# Boas-vindas R2 via Template Oficial (Meta-approved) no Twilio

## Contexto
Hoje o `automation-event-dispatcher` envia a mensagem de Boas-vindas R2 como texto livre via Twilio (`Body=...`). Isso só funciona dentro da janela de 24h de sessão. Como o disparo ocorre logo após o Contrato Pago — e frequentemente fora dessa janela — o envio precisa usar um **template HSM aprovado pela Meta**, referenciado no Twilio por **ContentSid + ContentVariables**, com botão CTA "Agendar R2".

## Passo 1 — Cadastro do template no Twilio (manual, feito por você)

No **Twilio Content Editor** (Console → Messaging → Content Template Builder), criar:

- **Nome (friendly name):** `boas_vindas_r2_contrato_pago`
- **Idioma:** `pt_BR` ("Portugues BR")
- **Categoria Meta:** `MARKETING` (é uma mensagem de próximos passos comerciais fora da janela; se a Meta reprovar como MARKETING, resubmeter como `UTILITY` argumentando que é follow-up transacional pós-compra).
- **Tipo de conteúdo Twilio:** `twilio/call-to-action` (permite corpo + botão URL) — ou `twilio/quick-reply` se quisermos futuramente botões de resposta; para este caso o CTA URL é o correto.
- **Corpo (com 1 variável):**

```
Olá, {{1}}! 🎉

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

- **Botão CTA (Call To Action):**
  - Tipo: `URL`
  - Rótulo: `Agendar R2`
  - URL: `https://hi.switchy.io/x9NB` (estática, sem variável — evita reprovação Meta por URL dinâmica)

- **Submeter para aprovação WhatsApp/Meta** direto pelo Content Editor.
- Após aprovado, copiar o **Content SID** (formato `HX...`).

## Passo 2 — Guardar o Content SID como secret

Adicionar via `add_secret`:
- `TWILIO_CONTENT_SID_BOAS_VINDAS_R2` = `HX...` (o SID aprovado)

Assim conseguimos trocar/versionar o template sem redeploy de código.

## Passo 3 — Ajuste no edge function `automation-event-dispatcher`

Trocar o envio de WhatsApp da action `whatsapp_boas_vindas_r2` para usar Content API do Twilio:

- Substituir o body `Body=...` (freeform) por:
  - `ContentSid=<TWILIO_CONTENT_SID_BOAS_VINDAS_R2>`
  - `ContentVariables={"1":"<primeiro nome do lead>"}` (JSON string url-encoded)
- Manter `From=whatsapp:<TWILIO_WHATSAPP_FROM>` e `To=whatsapp:<E.164 do lead>`.
- Manter idempotência atual (`boas_vindas_r2_whatsapp_enviado_em`) e o log em `automation_run_logs`.
- Se `TWILIO_CONTENT_SID_BOAS_VINDAS_R2` não estiver configurado, retornar erro claro e não cair no envio freeform (para não vazarmos mensagem fora de template).
- Se o Twilio devolver erro `63016` (freeform fora da janela) ou `63051` (template não aprovado), logar detalhado para diagnóstico.

## Passo 4 — Ajuste no card "Boas-vindas R2 (Contrato Pago)" em Administração → Automações

Em `FlowEditorDialog.tsx` (step do WhatsApp), quando a action for `whatsapp_boas_vindas_r2`:
- Exibir badge "Template Meta aprovado" com o nome `boas_vindas_r2_contrato_pago`.
- Mostrar o corpo em modo somente-leitura (fonte da verdade agora é o Content Editor no Twilio).
- Mostrar o botão CTA `Agendar R2 → https://hi.switchy.io/x9NB`.
- Manter apenas o toggle ativo/inativo e a variável `{{1}} = primeiro_nome`.

## Passo 5 — Documentação / Memory

Registrar em memory que disparos WhatsApp fora da janela de 24h devem sempre usar Twilio Content Template aprovado pela Meta (ContentSid + ContentVariables), nunca `Body` freeform.

## Detalhes técnicos

- Arquivos afetados:
  - `supabase/functions/automation-event-dispatcher/index.ts` — trocar payload Twilio para `ContentSid`/`ContentVariables`.
  - `src/components/admin/automacoes/FlowEditorDialog.tsx` — UI somente-leitura do template.
  - Novo secret: `TWILIO_CONTENT_SID_BOAS_VINDAS_R2`.
- Sem migração de schema.
- Idempotência e trigger `trg_notify_attendee_contract_paid` permanecem.
- Após o template ser aprovado pela Meta, o mesmo fluxo passa a funcionar 24/7, inclusive fora da janela de sessão.
