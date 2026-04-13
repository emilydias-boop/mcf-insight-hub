

## Plano: Configurar remetente Brevo

Atualizar o email remetente na Edge Function `brevo-send` de `notificacoes@minhacasafinanciada.com` para `marketing@minhacasafinanciada.com`.

### Alteração

**Arquivo:** `supabase/functions/brevo-send/index.ts` (linha 38)
- De: `email: 'notificacoes@minhacasafinanciada.com'`
- Para: `email: 'marketing@minhacasafinanciada.com'`

Depois, fazer redeploy da function `brevo-send`.

