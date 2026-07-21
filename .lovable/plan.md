## Diagnóstico (por que está indo para EA+Clube)

Os leads das telas (Adriano, Natália) **não entraram pelo webhook "Lead Guia"**. Eles são compras Hubla do produto **"Guia - Como Financiar 100% na CAIXA"** (`invoice.payment_succeeded`, categoria enviada pela Hubla como `clube_arremate`), processadas pelo `hubla-webhook-handler`.

A cadeia de roteamento hoje é:

1. `supabase/functions/hubla-webhook-handler/index.ts`, função `mapProductCategory` (linhas 89-102):
   - Regra genérica: se o nome contém **"CLUBE"** e **"ARREMATE"** → `clube_arremate`.
   - O produto "Guia - Como Financiar 100% na CAIXA" **não** casa com essa regra por nome.
   - Porém a Hubla já manda `product.category = "clube_arremate"` no payload (o próprio produto está cadastrado sob o Clube do Arremate na Hubla), então o handler herda essa categoria.

2. Mapa `CATEGORY_TO_STAGE` (linha 2312): `clube_arremate` → `STAGE_CLUBE_ARREMATE` (`bf370a4f-…`), que é o stage inicial do pipeline **Efeito Alavanca + Clube**.

3. Lista `CONSORCIO_PRODUCT_CATEGORIES` inclui `clube_arremate`, então o deal recebe as auto-tags **`clube-arremate`, `Hubla`, `Consórcio`** e é vinculado ao pipeline de Consórcio (EA+Clube).

Resultado: toda compra do "Guia CAIXA" via Hubla vai para EA+Clube, mesmo sendo um infoproduto de topo de funil que deveria alimentar o Inside Sales.

## Correção proposta

### 1. Roteamento (edge function `hubla-webhook-handler`)
Adicionar exceção explícita em `mapProductCategory` **antes** da regra de Clube do Arremate:

```
if (name.includes('GUIA') && name.includes('CAIXA')) return 'guia_caixa';
```

E mapear a nova categoria:
- `CATEGORY_TO_STAGE['guia_caixa']` → stage **Novo Lead** de `PIPELINE INSIDE SALES` (`cf4a369c-c4a6-4299-933d-5ae3dcc39d4b`).
- Remover `guia_caixa` do fluxo de Consórcio (não entra em `CONSORCIO_PRODUCT_CATEGORIES`).
- Auto-tags aplicadas: `Guia`, `Hubla` (sem `Consórcio` / `clube-arremate`).

### 2. Reprocesso histórico
Migrar os deals já criados desse produto:

```text
UPDATE crm_deals
SET origin_id = <INSIDE SALES>,
    stage_id  = <Novo Lead>,
    tags      = tags corrigidas (- clube-arremate, - Consórcio, + Guia)
WHERE id IN (
  SELECT linked_deal_id FROM hubla_transactions
  WHERE product_name ILIKE '%Guia%CAIXA%' AND linked_deal_id IS NOT NULL
);
```

Antes de rodar, faço um `SELECT` de conferência para você aprovar o volume/lista (aparente ~compras com esse produto entre 07/07 e 20/07).

### 3. Validação
- Reenviar 1 evento Hubla de teste pelo painel e conferir o deal criado (pipeline Inside Sales, stage Novo Lead, tags Guia + Hubla).
- Conferir os deals reprocessados na tela `/crm/negocios` filtrando pela origem Inside Sales.

## Fora do escopo
- Webhook "Lead Guia" (`/webhook-lead-receiver/lead-guia`) permanece como está: já aponta para Inside Sales / Novo Lead.
- Nenhuma outra categoria Hubla é alterada.
