## Problema (em linguagem simples)

Hoje, uma venda de **A017** chega da Hubla com o nome de produto **"Construir Para Alugar"** — exatamente o mesmo nome do orderbump A010 → Viver de Aluguel. Por isso o webhook erra em dois pontos:

1. **Classifica A017 como orderbump** (`ob_construir_alugar`) em vez de tratar como venda principal.
2. **Quando cria/atualiza deal no Inside Sales**, usa `ilike '%Novo Lead%'` sem ordenação → pega a primeira stage que aparecer, que é "A017 - Novo Lead" mesmo quando deveria ser "Novo Lead" (A010).

Resultado real do payload que você mandou (deal `1c9e2980` do Denis): venda foi de A017, virou deal "Denis - A010" na stage errada "A017 - Novo Lead" com tags `[A010, Hubla, A017]`.

## Regra desejada

| Produto recebido | Deal criado | Stage destino |
|---|---|---|
| A010 sozinho ou com A017 junto | "Nome - A010" | **Novo Lead** (`cf4a369c-c4a6-4299-933d-5ae3dcc39d4b`) |
| A017 sozinho ou com A010 junto | "Nome - A017" | **A017 - Novo Lead** (`8a0b84d0-7b7a-479a-8c8e-e1067f1a3fda`) |
| A010 + A017 mesma fatura | **2 deals separados**, mesmo contato | um em cada stage |

A010 e A017 nunca mais são tratados como orderbump um do outro — cada um sempre gera lead próprio.

## Como detectar A017 no payload

Como o produto Hubla "Construir Para Alugar" é compartilhado entre A017 e o orderbump Viver de Aluguel, vou usar uma cascata de sinais:

1. **Whitelist de `offer.id` da A017** (mais confiável). Começo com `sSUhrvi36mbjRN8gOwhs` ("Construir Para Alugar - VSL"), já visto no payload do Denis. Você pode me passar outros offer.id depois.
2. **Fallback: UTM/URL contém `A017`** (`paymentSession.url`, `utm.campaign` ou `utm.content`). Captura vendas via ofertas novas que ainda não estejam na whitelist.
3. Se nenhum dos dois bate e o produto é "Construir Para Alugar", segue o caminho atual de orderbump Viver de Aluguel (preserva vendas legítimas de Viver).

## Mudanças no código

Tudo em `supabase/functions/hubla-webhook-handler/index.ts`:

1. **`A017_OFFER_IDS`** — constante com a whitelist de offer.id da A017.
2. **`detectA017Sale(event)`** — retorna `true` se `offer.id` está na whitelist OU se UTM/URL contém `A017` (regex case-insensitive).
3. **`createA017Deal(...)`** — cria deal no Inside Sales:
   - Contato deduplicado por email e telefone (9 dígitos), padrão do projeto.
   - Stage fixa por **ID** (`8a0b84d0-7b7a-479a-8c8e-e1067f1a3fda` = "A017 - Novo Lead").
   - Nome do deal: `"<Cliente> - A017"`, tags `["A017", "Hubla"]`.
   - Se já existir deal A017 do mesmo contato, só atualiza tags/atividade (não duplica).
4. **Roteador principal**: antes do bloco `ob_construir_alugar`, checar `detectA017Sale`:
   - Se A017 e não tem A010 na fatura → cria só o deal A017 e encerra.
   - Se A017 + A010 juntos → cria deal A017 e continua o fluxo A010 (dois deals, mesmo contato).
5. **Corrigir stage do A010**: substituir todo `.ilike('stage_name', '%Novo Lead%')` no fluxo Inside Sales por **ID fixo** `cf4a369c-c4a6-4299-933d-5ae3dcc39d4b` — elimina a ambiguidade.
6. **Migração corretiva (opcional, vou listar antes de mover)**: identificar deals já criados errados — A010 parado em "A017 - Novo Lead" e vendas A017 recentes classificadas como Viver de Aluguel — e reclassificar. Te mostro a lista antes de aplicar.

## O que NÃO muda

- Vendas de Renovação, Clube Arremate, Viver de Aluguel legítimo, A000, parceiros etc. seguem com o roteamento atual.
- Dedup de contato (email + telefone 9 dígitos) preservado.
- Lógica de tags/cross-pipeline do orderbump real (`ob_construir_alugar` quando não é A017) preservada.

## Validação

1. Re-disparar o webhook do Denis em sandbox → conferir deal na stage "A017 - Novo Lead" com nome "… - A017" e tags `[A017, Hubla]`.
2. Simular payload A010 puro → conferir que cai em "Novo Lead" (stage_order 5), não em "A017 - Novo Lead".
3. Simular payload A010+A017 → conferir 2 deals separados, mesmo contato, stages corretas.

## Depois que eu implementar, preciso de você

- Confirmar/ampliar a whitelist de `offer.id` da A017 se houver mais ofertas além da VSL.
- Aprovar (ou não) o passo 6, a migração corretiva dos deals já criados errados.
