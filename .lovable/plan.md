## Objetivo
Quando o email de boas-vindas de nova Carta de Consórcio for enviado ao cliente (após cadastro em Cadastros Pendentes), incluir em cópia (CC):
- emily.dias@minhacasafinanciada.com
- antony.nicolas@minhacasafinanciada.com

## Alteração
Arquivo: `src/hooks/useConsorcioPendingRegistrations.ts` (linha ~474)

No `body` do `supabase.functions.invoke('brevo-send', …)` que envia o boas-vindas, adicionar:

```ts
cc: [
  { email: 'emily.dias@minhacasafinanciada.com', name: 'Emily Dias' },
  { email: 'antony.nicolas@minhacasafinanciada.com', name: 'Antony Nicolas' },
],
```

A edge function `brevo-send` já suporta o campo `cc` nativamente (linha 105 do `supabase/functions/brevo-send/index.ts`), portanto nenhuma outra alteração é necessária.

## Escopo
- Aplica-se apenas ao email de boas-vindas disparado no cadastro pendente da carta (mesma regra idempotente atual via `boas_vindas_enviado_em`).
- Sem mudanças em outras automações, edge functions ou UI.