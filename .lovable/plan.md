

## Problema Critico: Detecao de Outside falhando para ~98% dos contratos

### Diagnostico

A detecao de leads "Outside" usa o filtro `offer_id = 'pgah16gjTMdAkqUMVKGz'` em 6 arquivos. Porem, os dados de fevereiro/2026 mostram que **apenas 7 de ~380 contratos** possuem esse `offer_id`. A grande maioria tem `offer_id = NULL` (357 registros) ou outros IDs variados.

O caso do Altayr e um exemplo direto: contrato pago em 21/02, reuniao R1 em 24/02, mas nao foi detectado como Outside porque seu contrato tem `offer_id = NULL`.

### Causa raiz

Mudanca no lado do Hubla: transacoes mais recentes nao estao mais enviando o `offer_id` antigo (`pgah16gjTMdAkqUMVKGz`). O campo `product_name` e `product_category` continuam sendo preenchidos corretamente.

### Solucao

Trocar o filtro de `offer_id` para usar `product_category` e `product_name`, que sao campos confiaveis e preenchidos consistentemente:

**Filtro novo:**
- `product_category IN ('contrato', 'incorporador')`
- `product_name ILIKE '%contrato%'`

Isso cobre todos os tipos de contrato relevantes (A000 - Contrato, Contrato, Contrato - Socio MCF, A000 - Contrato MCF) e exclui automaticamente produtos de outras BUs (Efeito Alavanca, Clube do Arremate) por nao terem `product_category = 'contrato'` ou `'incorporador'`.

### Arquivos a alterar (6 arquivos, mesma mudanca em todos)

1. **`src/hooks/useOutsideDetection.ts`** (linha 67)
   - Remover `.eq('offer_id', 'pgah16gjTMdAkqUMVKGz')`
   - Adicionar `.in('product_category', ['contrato', 'incorporador'])` e `.ilike('product_name', '%contrato%')`

2. **`src/hooks/useOutsideDetectionForDeals.ts`** (linha 77)
   - Mesma troca de filtro

3. **`src/hooks/useSdrOutsideMetrics.ts`** (linha 112)
   - Mesma troca de filtro

4. **`src/hooks/useR1CloserMetrics.ts`** (linha 331)
   - Mesma troca de filtro

5. **`supabase/functions/distribute-outside-leads/index.ts`** (linha 110)
   - Mesma troca de filtro (Edge Function - necessita redeploy)

6. **Nenhuma migracao necessaria** - os campos `product_category` e `product_name` ja estao populados nos dados existentes.

### Impacto esperado

- Altayr e todos os outros leads com contrato pago antes da R1 passam a ser corretamente identificados como Outside.
- O numero de Outsides detectados vai aumentar significativamente (de ~2% para 100% dos contratos reais).
- O painel de SDRs vai refletir os numeros corretos.
- A distribuicao automatica de leads Outside vai funcionar para todos os casos.

