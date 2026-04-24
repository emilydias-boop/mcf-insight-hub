## Problema atual
Hoje a classificação de canais usa lógica simples (qualquer tag/origem com "A010" → A010, qualquer tag/origem com "ANAMNESE/LIVE/LANÇ" → ANAMNESE, default → OUTROS). Isso joga muita coisa em "OUTROS" que deveria estar em ANAMNESE, e atribui A010 a leads antigos que não vieram do produto recente.

## Nova regra de classificação (proposta pelo usuário)

**Para cada deal/lead, decidir o canal nesta ordem:**

### 1. **A010** (prioridade máxima — só se "fresh")
Lead é considerado **A010** se:
- Tem **compra do produto A010** (`hubla_transactions.product_name ILIKE '%A010%'`, `sale_status='completed'`) E
- A data da compra está **dentro de 30 dias antes do `deal.created_at`** (ou após, mas dentro de 30 dias)

OU:
- Tem **tag A010** no deal E **NÃO tem nenhuma tag ANAMNESE/LIVE/ANAMNESE-INSTA** E não há compra A010 antiga (>30d)

### 2. **ANAMNESE** (canal de funil reconhecido)
Lead é considerado **ANAMNESE** se:
- Tem alguma tag em `{LIVE, ANAMNESE, ANAMNESE-INSTA}` no deal, OU
- Tem origem (pipeline name) com `LIVE / ANAMNESE / LANÇAMENTO`, OU
- Tem **compra A010 antiga** (>30 dias antes do deal) — **mesmo que ainda tenha tag A010** (regra "lead reciclado virou anamnese"), OU
- Foi reconhecido como attendee de R1 mas não tem nenhum sinal claro (default para R1)

### 3. **OUTROS**
- Não tem nenhuma das condições acima (sem tag relevante, sem compra A010, sem R1).

> **Observação importante:** A regra dos 30 dias inverte a prioridade da classificação anterior. Antes, "qualquer tag A010" virava A010. Agora, se a compra A010 dele é antiga, ele é tratado como **lead que virou Anamnese** e a tag A010 fica subordinada à data.

## Mudanças técnicas

### A) RPC `get_channel_funnel_metrics` (Postgres) — nova migration
A RPC atualmente classifica usando apenas tags/origem/lead_channel. Precisa ser reescrita para:
1. Carregar mapa `email → first_a010_purchase_date` de `hubla_transactions` (lookback 24 meses).
2. Para cada deal, computar `a010_purchase_age = deal.created_at - first_a010_purchase`.
3. Aplicar a hierarquia:
   - Se `a010_purchase_age IS NOT NULL` E `a010_purchase_age <= 30 days` E `a010_purchase_age >= -1 day` → **A010**
   - Senão, se tem tag/origem em `{LIVE, ANAMNESE, ANAMNESE-INSTA, LANÇAMENTO}` → **ANAMNESE**
   - Senão, se `a010_purchase_age > 30 days` (compra antiga) → **ANAMNESE** (lead reciclado)
   - Senão, se tem tag A010 sem compra registrada → **A010**
   - Senão → **OUTROS**

Isso afeta as colunas: **Entradas, R1 Agend., R1 Realiz., No-Show, Contrato Pago**.

### B) `dealChannelMap` em `useChannelFunnelReport.ts` (linhas 427-487)
Mesma lógica precisa ser aplicada no TS para os deals do Carrinho:
1. Estender a query de `crm_deals` para também trazer `created_at` e o `email` do contato.
2. Criar um índice `email → first_a010_purchase` consultando `hubla_transactions` (uma query única para todos os emails do carrinho).
3. Substituir a função `classify(tagsRaw, originId)` por `classify(tagsRaw, originId, dealCreatedAt, email)` que aplica a nova hierarquia.

Isso afeta as colunas: **R2 Agend., R2 Realiz., Aprovados, Reprovados, Próx. Semana**.

### C) `parceriaConversions` em `useChannelFunnelReport.ts` (linhas 227-417)
A função `classifyAtt` (linhas 397-406) também precisa receber o `email` da conversão e a data da venda para aplicar a mesma regra:
- Para cada conversão de parceria, buscar a primeira compra A010 do email
- Se compra A010 ≤ 30 dias antes da venda de parceria → **A010**
- Se compra A010 > 30 dias antes → **ANAMNESE**
- Senão, lógica atual (tags/origem/R1)

Isso afeta as colunas: **Venda Final, Fat. Bruto, Fat. Líquido**.

### D) Memory update
Atualizar `mem://reporting/commercial-channel-reporting-and-data-integrity-v5` com a nova regra dos 30 dias para classificação A010 vs ANAMNESE no relatório Funil por Canal (este relatório usa 3 buckets: A010 / ANAMNESE / OUTROS, diferente do agrupamento de 6 canais usado em outros relatórios).

## Resultado esperado
Com base em amostra de abril/2026:
- **142 deals** com compra A010 antiga (>30d) que hoje contam como A010 → **migram para ANAMNESE**
- **OUTROS** (hoje 269 entradas, 226 R1 Agend., 73 No-Show) deve cair drasticamente, pois a maioria desses leads tem tag de canal ou compra A010 antiga, e serão redistribuídos
- A consistência entre Entradas / R1 / R2 / Venda Final aumenta porque os 3 pontos de classificação passam a usar exatamente a mesma regra

## Arquivos afetados
1. **Nova migration SQL** — reescrever `get_channel_funnel_metrics` com a regra de 30 dias
2. **`src/hooks/useChannelFunnelReport.ts`** — atualizar `classifyAtt` e o builder do `dealChannelMap` com a regra de 30 dias e injeção de `email + created_at`
3. **`src/components/relatorios/ChannelFunnelTable.tsx`** — atualizar tooltip da coluna OUTROS / cabeçalho do relatório explicando a nova regra
4. **`mem://reporting/commercial-channel-reporting-and-data-integrity-v5`** — registrar a regra dos 30 dias

## Pontos para confirmar antes de implementar
1. **Janela de 30 dias é em relação ao `deal.created_at`** (entrada do lead) ou em relação à **data da venda final** (para parceria)? O texto sugere "compra A010 → ver data": vou usar `deal.created_at` para classificação de entrada/R1/R2, e `sale_date` da parceria para Venda Final/Faturamento. **Ok?**
2. Se um lead tem tag ANAMNESE **E** compra A010 recente (<30d), prevalece **A010** (compra recente é o mais forte). Confirmar?
3. Se um lead tem **só tag A010** (sem compra registrada na Hubla), continua sendo **A010**. Confirmar?