## Plano

Você colou o valor do `MCF_PAY_CALLBACK_SECRET` no chat. Vou:

1. Atualizar o secret `MCF_PAY_CALLBACK_SECRET` no CRM com o valor que você enviou (via `set_secret`, sem abrir formulário, sem ecoar o valor).
2. Redeployar a edge function `mcf-pay-callback` para garantir que pega o novo valor.
3. Disparar um POST de teste para extrair o novo fingerprint do CRM dos logs de erro 401.
4. Comparar com o fingerprint do MCF Pay (`38fe8923`):
   - **Se bater** → peço para você reenviar o webhook real do MCF Pay; deve retornar 200 e os 3 pagamentos pendentes serão reprocessados automaticamente.
   - **Se não bater** → significa que o valor copiado teve algum caractere invisível (espaço, quebra de linha). Aí partimos para a opção B: gero um segredo novo de 64 chars aqui no CRM e te mostro 1 vez para colar no MCF Pay.

**Recomendação de segurança após resolver**: rotacione esse segredo, já que ele apareceu no chat. Posso fazer isso no final como passo 5 (gera novo de 64 chars, mostra 1x para você colar no MCF Pay e substitui o atual).

Aprova?
