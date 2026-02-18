

# Fix: UTMs nao sendo salvos desde dezembro/2025

## Causa Raiz

O webhook da Hubla mudou o formato dos dados. Os campos UTM agora ficam em `event.invoice.paymentSession.utm` (com chaves `source`, `medium`, `campaign`, `content`), mas o webhook handler procura em `invoice.utm_source`, `invoice.utm_medium`, etc. -- campos que nao existem mais.

Resultado: **0 transacoes com UTM desde dezembro/2025** (3 meses de dados perdidos).

## Dados no webhook real

```text
event.invoice.paymentSession.utm.source    -> "FB"
event.invoice.paymentSession.utm.medium    -> "00 - PAGEVIEW 180D|120235..."
event.invoice.paymentSession.utm.campaign  -> "10/11/25 [CNSLTR][VENDAS]...|120235..."
event.invoice.paymentSession.utm.content   -> "ADS 002 - qual CNPJ voce precisa...|120235..."
```

## Correcoes

### 1. Webhook Handler - Extrair UTMs do caminho correto

**Arquivo: `supabase/functions/hubla-webhook-handler/index.ts`**

Antes de montar os `transactionData`, extrair UTMs de `invoice.paymentSession.utm`:

```typescript
const paymentUtm = invoice?.paymentSession?.utm || {};
const utmSource = paymentUtm.source || invoice?.utm_source || eventData?.utm_source || eventData?.utmSource || null;
const utmMedium = paymentUtm.medium || invoice?.utm_medium || eventData?.utm_medium || eventData?.utmMedium || null;
const utmCampaign = paymentUtm.campaign || invoice?.utm_campaign || eventData?.utm_campaign || eventData?.utmCampaign || null;
```

Aplicar em **3 locais**:

- **Linha ~1282** (NewSale): trocar para usar `utmSource/utmMedium/utmCampaign`
- **Linha ~1379** (invoice sem items): trocar `null` para usar as variaveis extraidas
- **Linha ~1503** (invoice com items): trocar para usar as variaveis extraidas

### 2. Tambem capturar `utm_content` (campo "anuncio")

**Migracao SQL**: Adicionar coluna `utm_content` em `hubla_transactions`:

```sql
ALTER TABLE hubla_transactions ADD COLUMN IF NOT EXISTS utm_content TEXT;
```

Adicionar `utm_content` nos 3 locais do webhook handler:

```typescript
const utmContent = paymentUtm.content || invoice?.utm_content || null;
```

### 3. Reprocessar webhooks de dez/2025 ate agora

Apos o deploy do webhook corrigido, usar a edge function `reprocess-hubla-webhooks` (ou criar um script SQL) para preencher os UTMs das ~16.000 transacoes de dez/2025 a fev/2026. Isso pode ser feito com um UPDATE direto:

```sql
UPDATE hubla_transactions ht
SET 
  utm_source = COALESCE(
    ht.raw_data->'event'->'invoice'->'paymentSession'->'utm'->>'source',
    ht.utm_source
  ),
  utm_medium = COALESCE(
    ht.raw_data->'event'->'invoice'->'paymentSession'->'utm'->>'medium',
    ht.utm_medium
  ),
  utm_campaign = COALESCE(
    ht.raw_data->'event'->'invoice'->'paymentSession'->'utm'->>'campaign',
    ht.utm_campaign
  ),
  utm_content = ht.raw_data->'event'->'invoice'->'paymentSession'->'utm'->>'content'
WHERE ht.sale_date >= '2025-12-01'
  AND ht.utm_source IS NULL
  AND ht.raw_data->'event'->'invoice'->'paymentSession'->'utm'->>'source' IS NOT NULL;
```

### 4. Dashboard - Periodo padrao inteligente

**Arquivos: `MarketingDashboard.tsx` e `CampanhasDashboard.tsx`**

Manter mes atual como padrao (vai funcionar apos reprocessamento).

### 5. Coluna "Anuncio" na tabela de Campanhas

**Arquivo: `CampanhasDashboard.tsx`**

Adicionar coluna "Anuncio" (`utm_content`) na tabela, e atualizar o hook para buscar esse campo.

**Arquivo: `useMarketingMetrics.ts`**

Adicionar `utm_content` ao select e ao agrupamento de `useCampaignBreakdown`.

---

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/hubla-webhook-handler/index.ts` | Extrair UTMs de `paymentSession.utm` nos 3 locais |
| `src/pages/bu-marketing/CampanhasDashboard.tsx` | Adicionar coluna "Anuncio" |
| `src/hooks/useMarketingMetrics.ts` | Adicionar `utm_content` ao select/agrupamento |

## Migracao SQL

| Alteracao | SQL |
|---|---|
| Nova coluna | `ALTER TABLE hubla_transactions ADD COLUMN IF NOT EXISTS utm_content TEXT` |
| Backfill dados | UPDATE com dados de `raw_data` para preencher UTMs de dez/2025+ |

## Resultado Esperado

- Novas transacoes terao UTMs preenchidos automaticamente
- Transacoes de dez/2025 a fev/2026 serao retroativamente preenchidas
- Dashboard mostrara dados de todos os meses, nao apenas ate nov/2025
- Nova coluna "Anuncio" mostrara o nome do ad especifico
