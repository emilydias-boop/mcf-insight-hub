## Objetivo
Após cadastrar a carta em Controle Consórcio (mesmo gatilho que hoje dispara o email Brevo de boas-vindas), enviar também via **WhatsApp API oficial** uma mensagem com o mesmo conteúdo do email para o telefone do lead cadastrado.

## Provedor
Reutilizar a integração já existente do projeto: edge function `twilio-whatsapp-send` (Twilio WhatsApp Business API), que já autentica, aceita `to`, `body`, `templateSid`/`contentVariables` e registra em `whatsapp_messages`.

Observação importante: WhatsApp oficial fora da janela de 24h exige **template HSM aprovado**. Como você optou por criar/aprovar depois, a arquitetura já ficará preparada — o disparo usa `templateSid` + variáveis quando configurado; enquanto o template não estiver aprovado, o disparo tentará como texto livre (`body`) e vai falhar silenciosamente para leads fora da janela (log + toast, sem bloquear o cadastro).

## Fluxo
1. Em `src/hooks/useConsorcioPendingRegistrations.ts`, logo após o bloco de envio do email de boas-vindas (linhas ~469-507), adicionar bloco análogo de envio WhatsApp:
   - Pegar `telefone` de `input.telefone` (ou `telefone_comercial` para PJ) — mesmo padrão já usado.
   - Normalizar para E.164 (`+55` + dígitos).
   - Idempotência: nova coluna `boas_vindas_whatsapp_enviado_em` em `consorcio_pending_registrations` (só dispara se null).
   - Invocar `supabase.functions.invoke('twilio-whatsapp-send', { body: { to, templateSid, contentVariables: { '1': nomeCliente }, dealId } })`.
   - Se falhar, `console.error` + toast leve, sem bloquear o cadastro (mesmo padrão do email).
   - Se sucesso, gravar timestamp na coluna nova.

2. Novo helper `src/lib/consorcioBoasVindasWhatsapp.ts` com a versão **texto** (plain) do email, formatada para WhatsApp (parágrafos, `*negrito*`, contatos Emily/Antony com wa.me). Usada tanto como `body` de fallback quanto como referência para o texto do template HSM que você vai submeter à Meta/Twilio.

3. Migration:
   - `ALTER TABLE public.consorcio_pending_registrations ADD COLUMN IF NOT EXISTS boas_vindas_whatsapp_enviado_em timestamptz;`
   - Nova secret opcional `TWILIO_CONSORCIO_BOAS_VINDAS_TEMPLATE_SID` (lida por variável de ambiente Vite? não — ficará via `import.meta.env.VITE_TWILIO_CONSORCIO_TEMPLATE_SID` para o front, ou muda-se o disparo para uma edge function nova). Ver seção técnica.

4. Botão "Reenviar WhatsApp de boas-vindas" no card em Controle Consórcio → Cadastros Pendentes (mesmo local do "Reenviar webhook" já existente), força o disparo ignorando idempotência.

## Detalhes técnicos
- Para manter o `templateSid` fora do front-end, criar edge function fina `consorcio-boas-vindas-whatsapp`:
  - Recebe `{ registrationId, force? }`.
  - Lê registro, monta nome/telefone, monta `contentVariables` e chama `twilio-whatsapp-send` internamente (service role) com `templateSid = Deno.env.get('TWILIO_CONSORCIO_BOAS_VINDAS_TEMPLATE_SID')`. Se a env não estiver setada, envia como `body` texto livre (dev/janela 24h).
  - Atualiza `boas_vindas_whatsapp_enviado_em`.
- O hook `useCriarCadastroPendente` chama essa nova edge function em vez de invocar `twilio-whatsapp-send` diretamente.
- Botão de reenvio no `PendingRegistrationsList` chama a mesma edge function com `force: true`.
- Nenhum contato com WhatsApp é feito quando telefone estiver vazio.

## Fora de escopo
- Aprovação do template HSM em si (você faz no console Twilio/Meta e me passa o SID via `add_secret` depois).
- Alterar o email atual.
- Disparos para outras etapas do funil.