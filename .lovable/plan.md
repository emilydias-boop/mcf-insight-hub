
# Correcao: Deteccao de Outside pela Oferta Especifica + Visibilidade no Kanban

## Contexto do Problema

Leads "Outside" sao identificados pela compra da oferta especifica **"Contrato - Curso R$ 97,00"** (offer ID `pgah16gjTMdAkqUMVKGz`). Atualmente o sistema usa `ilike('%Contrato%')` no `product_name`, capturando milhares de produtos irrelevantes. Alem disso, a tabela `hubla_transactions` nao armazena o offer name/ID, impossibilitando a identificacao correta.

## Solucao em 4 Partes

### Parte 1: Adicionar colunas `offer_name` e `offer_id` na tabela `hubla_transactions`

Criar uma migracao SQL para adicionar duas novas colunas:

```
ALTER TABLE hubla_transactions ADD COLUMN offer_name TEXT;
ALTER TABLE hubla_transactions ADD COLUMN offer_id TEXT;
```

### Parte 2: Backfill historico dos 31 registros que ja tem groupId no raw_data

Executar um UPDATE para preencher os registros que ja possuem o `groupId` no campo `raw_data`:

```
UPDATE hubla_transactions
SET 
  offer_id = raw_data->'event'->>'groupId',
  offer_name = 'Contrato - Curso R$ 97,00'
WHERE raw_data->'event'->>'groupId' = 'pgah16gjTMdAkqUMVKGz'
  AND offer_id IS NULL;
```

Isso cobre os 31 registros historicos que vieram por webhook e possuem o dado.

### Parte 3: Modificar o webhook handler para salvar offer_name e offer_id

**Arquivo:** `supabase/functions/hubla-webhook-handler/index.ts`

Na secao que monta o `transactionData` (linhas ~1676-1700), extrair o offer do webhook v2:

- Extrair `offers[0].id` e `offers[0].name` do array `event.products`
- Fallback: usar `event.groupId` como offer_id (formato webhook v1/NewSale)
- Salvar nos novos campos `offer_id` e `offer_name` da transacao

### Parte 4: Atualizar deteccao de Outside em 6 arquivos

Substituir o filtro `ilike('product_name', '%Contrato%')` por `eq('offer_id', 'pgah16gjTMdAkqUMVKGz')` em:

| # | Arquivo | Uso |
|---|---------|-----|
| 1 | `src/hooks/useOutsideDetectionForDeals.ts` (linha 77) | Badge Outside no Kanban |
| 2 | `src/hooks/useOutsideDetection.ts` (linha 67) | Deteccao em reunioes |
| 3 | `src/hooks/useSdrOutsideMetrics.ts` (linha 112) | Metricas SDR |
| 4 | `src/hooks/useR1CloserMetrics.ts` (linha 331) | Metricas Closer |
| 5 | `supabase/functions/distribute-outside-leads/index.ts` (linha 110) | Distribuicao automatica |
| 6 | `src/pages/crm/Negocios.tsx` (linhas 491-502) | Filtro Trabalhado/Nao Trabalhado |

A mudanca em cada arquivo e simples:

```text
Antes:  .ilike('product_name', '%Contrato%')
Depois: .eq('offer_id', 'pgah16gjTMdAkqUMVKGz')
```

### Parte 5: Corrigir logica Trabalhado/Nao Trabalhado

No arquivo `src/pages/crm/Negocios.tsx`, atualizar os filtros `outside_worked` e `outside_not_worked` para considerar o estagio do deal:

- **Outside Trabalhado**: Lead saiu do estagio "Novo Lead" (esta em LQ, R1 Agendada, Contrato Pago, etc.) OU tem atividades reais (calls/notas/whatsapp)
- **Outside Nao Trabalhado**: Lead ainda esta em "Novo Lead" E sem atividades reais

## Resumo de Alteracoes

| Tipo | Detalhe |
|------|---------|
| Migracao SQL | 2 colunas novas (`offer_name`, `offer_id`) |
| Backfill SQL | UPDATE de ~31 registros historicos |
| Edge Function | `hubla-webhook-handler` - salvar offer_id/offer_name |
| Hooks frontend | 4 hooks - trocar filtro de deteccao |
| Edge Function | `distribute-outside-leads` - trocar filtro |
| Negocios.tsx | Logica de Trabalhado baseada em estagio |

## Resultado Esperado

- Apenas leads que compraram pela oferta "Contrato - Curso R$ 97,00" sao identificados como Outside
- Novos webhooks passam a salvar o offer ID automaticamente
- Leads como Arthur (Contrato Pago, 0 atividades manuais) aparecem como "Outside Trabalhado"
- Leads em "Novo Lead" sem atividades aparecem como "Outside Nao Trabalhado"
- SDRs conseguem identificar claramente os Outsides no Kanban para agendar R1
