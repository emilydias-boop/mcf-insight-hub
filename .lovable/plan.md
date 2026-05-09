## Diagnóstico

**Não é bug** — é fluxo manual em 3 passos que confunde:
1. **Salvar** → grava o template no banco (status `draft`, sem `twilio_template_sid`).
2. **Criar no Twilio** (botão no painel de Status Meta) → chama `twilio-content-manage` para criar o Content e gravar o `twilio_template_sid`.
3. **Submeter à Meta** (botão que aparece depois) → envia para aprovação WhatsApp; status vai para `pending`.

Você salvou e parou no passo 1 → continua `Rascunho`. O painel "Status Meta" com os botões só aparece **em modo edição** (depois de salvar e reabrir).

## Solução proposta

Adicionar um **botão primário "Salvar e Enviar para Meta"** no rodapé do `TemplateEditorDialog` que executa o pipeline completo:

```
salvar (create/update)
 → createTwilio (cria Content na Twilio)
 → submitTwilio (submete pra aprovação Meta)
 → fechar diálogo
```

Manter o botão **"Salvar rascunho"** como secundário para quem quer apenas rascunhar.

### Detalhes técnicos
- Arquivo: `src/components/automations/TemplateEditorDialog.tsx`
- Apenas para `channel === 'whatsapp'`. Email continua com 1 botão "Salvar".
- Reaproveitar `useCreateTemplate`, `useUpdateTemplate`, `useCreateTwilioContent`, `useSubmitTwilioContent` (já importados).
- Tratar erro em cada etapa via toast (já existem nos hooks). Se falhar Twilio, template fica salvo como draft (não regredir).
- Para criação nova (sem `templateId`), pegar `id` do retorno do `createTemplate.mutateAsync` antes de chamar Twilio.
- Desabilitar o botão se `category === 'marketing'` + faltar BU/conteúdo válido? Não — Meta valida; deixar usuário tentar.

## Validação

1. Abrir o template "Boas Vindas" → clicar **"Salvar e Enviar para Meta"** → toasts em sequência → status passa a `Aguardando Meta`.
2. Em alguns minutos, **Sincronizar status** → vira `Aprovado` (ou `Rejeitado` com motivo, se Meta recusar).

## Risco

- Categoria `marketing` + URL com variável (`https://wa.me/{{dono_telefone}}`) tem alta chance de **rejeição pela Meta**. Se rejeitar, recomendarei trocar para `utility` e/ou usar URL fixa.
