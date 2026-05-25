
## Diagnóstico

Investiguei os logs do Twilio, o `AutoDialerPanel`, o `TwilioContext`, os hooks de BU/origens do SDR e os webhooks da edge function. Os 3 sintomas que você reportou têm 2 causas independentes.

### 1. "Mulher falando no fundo" → na verdade é a mensagem de erro padrão do Twilio

Nos logs da função `twilio-voice-twiml` ainda aparece, mesmo após o último fix:

```
[twilio-voice-twiml] Invalid Twilio signature for url: https://edge-runtime.supabase.com/twilio-voice-twiml
```

O host reconstruído está vindo como `edge-runtime.supabase.com` — não `rehcfgqvigfcekiipqkc.supabase.co`. O Twilio assina a requisição com a URL pública (`https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/twilio-voice-twiml`), então o HMAC nunca bate e a função responde **403 Forbidden**.

Quando o Twilio recebe 403 ao buscar o TwiML, ele toca a locução padrão de erro (a voz feminina dizendo "We're sorry, an application error has occurred. Goodbye." ou variante em PT) — exatamente o que você está ouvindo. Por isso a ligação "abre" mas você só ouve a mensagem automática.

O fix anterior usando `x-forwarded-host` não resolveu porque, na infraestrutura atual da edge function, esse header chega com o domínio interno do runtime, não com o domínio público do projeto. A solução robusta é **reconstruir a URL pública a partir de `SUPABASE_URL`** (variável já injetada pela plataforma), ignorando os headers de proxy quando o host resultante não é o público do projeto.

### 2. Seletor de estágio sumiu / contagem zerada para SDR

No `AutoDialerPanel.tsx`:

```ts
// 497-532
{restrictToSdrOrigins ? (
  sdrPipelineOptions.length > 1 && (
    <div>… seletor de pipeline …</div>
  )
) : ( … admin: PipelineSelector … )}
```

- Para SDR (`restrictToSdrOrigins=true`) o seletor de pipeline **só aparece se houver mais de 1 origem permitida**.
- Se houver **1 origem**, o `useEffect` auto-seleciona (`setPipelineId`).
- Se houver **0 origens** (caso real quando `allowed_origin_ids` está vazio E `useBUPipelineMap` devolve `origins: []`, p.ex. SDR sem BU ativa, ou BU sem mapeamento no banco e sem fallback), **nenhum pipeline é selecionado**, o seletor de estágio fica desabilitado (`disabled={!pipelineId}`), nenhum botão "Carregar leads" funciona e a contagem fica `0`/sem número.

Como você confirmou que está acontecendo com outros SDRs também, é provável que algum mapeamento BU↔origens tenha mudado, deixando o SDR sem origens carregadas. Hoje o painel **não dá nenhum feedback** nessa situação — só some o seletor.

Além disso, o filtro local `q.eq('owner_profile_id', user.id)` no `fetchEligibleStageDeals` está correto (a tabela `profiles` usa `id = auth.user.id`), então não é causa adicional.

## Plano de correção

### A) Edge functions Twilio — eliminar de vez o 403 por assinatura

Em todas as 4 funções (`twilio-voice-twiml`, `twilio-voice-webhook`, `twilio-status-webhook`, `twilio-whatsapp-webhook`):

1. Reescrever `getPublicUrl(req)` para priorizar `Deno.env.get('SUPABASE_URL')`:
   ```ts
   const getPublicUrl = (req: Request): string => {
     const u = new URL(req.url);
     const base = Deno.env.get('SUPABASE_URL'); // https://<ref>.supabase.co
     if (base) return `${base.replace(/\/$/, '')}${u.pathname}${u.search}`;
     // fallback (mantém headers, mas nunca usa edge-runtime.supabase.com)
     const proto = req.headers.get('x-forwarded-proto') || 'https';
     const host  = req.headers.get('x-forwarded-host') || req.headers.get('host') || u.host;
     return `${proto}://${host}${u.pathname}${u.search}`;
   };
   ```
2. Adicionar uma **tentativa secundária** de validação: se a assinatura falhar com a URL primária, tentar também com a URL alternativa (com/sem `?...` se Twilio adicionou parâmetros) antes de devolver 403, logando ambas para diagnóstico (sem expor o token).
3. Atualizar o log de erro para incluir as URLs testadas, facilitando confirmar o fix em produção.

Efeito esperado: o TwiML passa a responder 200 com o `<Dial>` correto, a chamada disca o número real e a voz da mensagem automática some.

### B) Auto-Discador — seletor de pipeline visível mesmo com 0/1 origens

Em `src/components/sdr/AutoDialerPanel.tsx`:

1. **Sempre renderizar o seletor de pipeline para SDR**, mesmo com 1 opção (com a única opção selecionada e o select desabilitado) ou com 0 opções (mostrando estado vazio claro).
2. Quando `sdrPipelineOptions.length === 0`, exibir um aviso curto:
   _"Nenhuma pipeline liberada para você. Peça ao gestor para configurar suas origens permitidas (Configurações → SDR)."_
3. Manter o auto-select quando houver apenas 1 opção (comportamento atual), mas **sem ocultar** o controle — assim o SDR enxerga qual pipeline está ativa.
4. Acrescentar pequeno fallback de robustez: se `useBUPipelineMap` devolver `origins: []` mas `useSDROriginOverride` tiver IDs, usar o override mesmo sem BU ativa (já é o comportamento atual, só vou garantir que `sdrOriginIds` não dependa de `activeBU`).

Efeito esperado: o seletor de estágio volta a ficar habilitado, a contagem (`~N`) reaparece no botão de carregar leads e SDRs sem mapeamento veem uma mensagem clara em vez de um painel "morto".

### Nada que NÃO vou mexer

- Lógica do `TwilioContext` (token, device, AMD).
- Webhook de gravação e fluxo de `auto_move_deal_to_em_contato`.
- Painel de admin (sem `restrictToSdrOrigins`), que já mostra o `PipelineSelector` normalmente.

## Arquivos que serão alterados

- `supabase/functions/twilio-voice-twiml/index.ts`
- `supabase/functions/twilio-voice-webhook/index.ts`
- `supabase/functions/twilio-status-webhook/index.ts`
- `supabase/functions/twilio-whatsapp-webhook/index.ts`
- `src/components/sdr/AutoDialerPanel.tsx`

## Como vou validar

1. Após o redeploy das 4 functions, abrir os logs de `twilio-voice-twiml` e confirmar que o erro `Invalid Twilio signature for url: https://edge-runtime.supabase.com/...` desapareceu e que uma chamada de teste produz o TwiML `<Dial>` (200 OK).
2. No painel do SDR, confirmar que o seletor de pipeline aparece mesmo com 1 origem; quando 0, mostra a mensagem orientativa.
3. Após selecionar pipeline + estágio, confirmar que o botão exibe `~N` e que "Carregar leads do estágio" popula a fila.
