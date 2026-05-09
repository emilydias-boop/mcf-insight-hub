## Causa raiz (confirmada pelo Twilio)

> "Only one variable can be added to the end of a URL."

O botão hoje está como `https://wa.me/{{2}}?text={{3}}` — duas variáveis e uma no meio. A Meta nunca aprova. Por isso o template está travado em `pending`.

## Solução: edge function `wa-redirect` como ponte

A Meta vê **uma URL fixa com uma variável no final**. O usuário final continua caindo no WhatsApp com **número do dono + texto pré-preenchido** — UX idêntica.

```
Botão:  https://rehcfgqvigfcekiipqkc.functions.supabase.co/wa-redirect/{{1}}
                                                                       ↑ token
Token:  base64url({ p:"5511999999999", t:"Olá, quero agendar minha reunião" })
Click:  302 → https://wa.me/5511999999999?text=Ol%C3%A1%2C%20quero%20agendar...
```

## Mudanças

### 1. Nova edge function `supabase/functions/wa-redirect/index.ts` (pública, sem JWT)

- `GET /wa-redirect/:token`
- Decodifica `token` (base64url) → `{ p, t }`.
- Valida `p` (apenas dígitos, 10–15 chars).
- Responde `302 Location: https://wa.me/<p>?text=<encodeURIComponent(t)>`.
- Fallback de erro: redirect para `https://wa.me/` puro.
- Adicionar entrada em `supabase/config.toml` com `verify_jwt = false`.

### 2. `supabase/functions/automation-processor/index.ts`

Substituir as variáveis `dono_telefone` + `wa_agendar_text` por uma única `wa_agendar_token`:

```ts
const tokenPayload = JSON.stringify({ p: donoTelefone, t: msgPorPapel });
const waAgendarToken = btoa(tokenPayload)
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
```

Mapa de variáveis ganha `wa_agendar_token`. Regex `usesDonoPhone` continua pulando o envio quando o dono não tem telefone.

### 3. Migration no template "Boa Vindas" (`cf53890c-...`)

```sql
UPDATE automation_templates
SET buttons_config = jsonb_build_array(jsonb_build_object(
      'text', 'Agendar Reunião',
      'type', 'url',
      'url', 'https://rehcfgqvigfcekiipqkc.functions.supabase.co/wa-redirect/{{wa_agendar_token}}'
    )),
    variables = ARRAY['nome', 'wa_agendar_token'],
    variable_count = 2,
    twilio_template_sid = NULL,
    approval_status = 'draft',
    approval_submitted_at = NULL,
    approval_updated_at = now()
WHERE id = 'cf53890c-532d-4c26-9661-f0910152c228';
```

Resultado no payload Twilio: URL vira `https://...functions.../wa-redirect/{{2}}` — **uma variável, no final**, conforme regra da Meta.

### 4. Após deploy + migration

Em `/admin/automacoes → Templates → Boa Vindas`:
1. **Criar no Twilio** (gera novo ContentSid).
2. **Submeter à Meta** — agora deve sair de `pending` em poucos minutos.
3. Disparar um teste real e validar que o botão abre WhatsApp com a mensagem certa.

## Arquivos impactados

- `supabase/functions/wa-redirect/index.ts` (novo)
- `supabase/config.toml` (declarar função pública)
- `supabase/functions/automation-processor/index.ts` (gerar `wa_agendar_token`)
- `supabase/migrations/<timestamp>_boavindas_use_wa_redirect.sql`
