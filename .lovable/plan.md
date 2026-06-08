## Objetivo

Quando a Hubla enviar `lead.abandoned_checkout` para o produto **A010**, criar (ou atualizar) o lead na PIPELINE INSIDE SALES na stage **"A010 Em Aberto"** com a tag `A010 Em Aberto`. Quando depois chegar a confirmação de compra (`invoice.payment_succeeded` do mesmo cliente), o lead já existente deve ser **movido para "Novo Lead"**, ter a tag `A010 Em Aberto` removida e ganhar a tag `A010`.

## Contexto descoberto

- A stage **"A010 Em Aberto"** já existe na origem `PIPELINE INSIDE SALES` (id `698ad6b1-...`, ordem 4).
- A stage **"Novo Lead"** já existe na mesma pipeline (id `cf4a369c-...`, ordem 5).
- Hoje, em `supabase/functions/hubla-webhook-handler/index.ts`, o evento `lead.abandoned_checkout` apenas faz um `console.log` (linha ~2503) — não cria nada.
- A função `processA010Lead` (linhas ~270–700) já implementa toda a lógica de dedupe por email/telefone, criação/atualização de contato + deal, herança de owner, tags e estágio "Novo Lead". Vou reaproveitá-la, parametrizando a stage e as tags.

## Mudanças

### 1. `supabase/functions/hubla-webhook-handler/index.ts`

**a) Generalizar `processA010Lead`**
- Aceitar dois novos parâmetros opcionais: `targetStageName` (default `"Novo Lead"`) e `extraTags` (default `["A010", "Hubla"]`).
- Na busca do estágio, usar `targetStageName` no `.ilike()` antes do fallback atual.
- Quando atualizar um deal existente: se o `targetStageName` for `"Novo Lead"`, **mover** o deal para "Novo Lead" e **remover** a tag `A010 Em Aberto` (substituindo por `A010`). Isso garante a promoção automática quando a compra cair depois do abandono.

**b) Detecção do produto A010 no `lead.abandoned_checkout`**
- Hubla manda os itens/oferta no payload do abandoned_checkout. Vou extrair `customer_email`, `customer_phone`, `customer_name` e os produtos do payload (`event.products` / `event.items` / `event.offer`) e checar se algum `product.name` casa com o mapeamento `A010` já existente no topo do arquivo.
- Se for A010, chamar `processA010Lead` com:
  - `targetStageName = "A010 Em Aberto"`
  - `extraTags = ["A010 Em Aberto", "Hubla"]`
  - `originName = 'A010 Hubla'` (mantém o redirecionamento automático para `PIPELINE INSIDE SALES`)
- Se não for A010, manter o log atual e não fazer nada.

**c) Fluxo de compra (já existente, ajuste mínimo)**
- O caminho `invoice.payment_succeeded` para A010 (linhas ~2163 e ~2336) já chama `processA010Lead` que, com a mudança em (a), vai encontrar o deal de "A010 Em Aberto" pelo email/telefone, mover para "Novo Lead", trocar as tags e atualizar valor/custom_fields. Nenhum deal duplicado será criado.

### 2. Dedupe / segurança

- Mantém o dedupe atual por `lower(email)` + sufixo de 9 dígitos do telefone (memória do projeto).
- Mantém a regra de A010 ficar **estritamente** em PIPELINE INSIDE SALES.
- Mantém a regra de bloqueio de parceiros (A001–A009/R001) — não se aplica aqui pois é A010.

### 3. Logs

- Adicionar logs claros: `🛒 [A010 ABANDONO]` na criação e `✅ [A010 PROMOVIDO] abandono → novo lead` quando um deal de "A010 Em Aberto" for movido para "Novo Lead".

## Não escopo

- Não criar novas stages (já existem).
- Não mexer em UI do CRM — o card vai aparecer naturalmente na coluna "A010 Em Aberto".
- Não criar a010_sales no abandono (só na compra confirmada, como hoje).

## Como validar

1. Disparar manualmente um `lead.abandoned_checkout` de teste da Hubla (ou via `curl_edge_functions`) com produto A010 → confere que aparece um card na coluna **A010 Em Aberto** com tag `A010 Em Aberto`.
2. Disparar em seguida `invoice.payment_succeeded` para o mesmo email → confere que o mesmo card foi movido para **Novo Lead**, tag virou `A010`, e nada foi duplicado.
3. Conferir logs em `hubla_webhook_logs` e nos logs da edge function.
