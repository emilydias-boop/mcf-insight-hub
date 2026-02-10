
# Corrigir contagem de Outside para meses com muitos leads

## Problema

O hook `useR1CloserMetrics` detecta leads "Outside" buscando transacoes na `hubla_transactions` via email. Para isso, faz duas queries com `.in()`:

1. `.in('id', dealIds)` -- buscar emails dos deals (826 UUIDs em janeiro)
2. `.in('customer_email', emails)` -- buscar contratos na hubla

Com 826+ UUIDs, a URL do request ultrapassa o limite do Supabase (aprox. 4000 chars no query string), e a query falha silenciosamente retornando resultados vazios. Em fevereiro, com apenas 294 deals, funciona normalmente.

## Solucao

Dividir as queries `.in()` em **batches de 200 itens** para garantir que a URL nunca exceda o limite, independente do volume de dados do mes.

## Alteracoes

### Arquivo: `src/hooks/useR1CloserMetrics.ts`

1. **Criar funcao auxiliar `batchedIn`**: Recebe um array grande e executa a query em lotes de 200, concatenando os resultados.

2. **Aplicar batch na query de deals** (linha 285-288):
   - Em vez de `supabase.from('crm_deals').select(...).in('id', Array.from(dealIds))`
   - Dividir `dealIds` em grupos de 200 e fazer queries paralelas

3. **Aplicar batch na query de hubla_transactions** (linha 303-309):
   - Em vez de `.in('customer_email', attendeeEmails)`
   - Dividir `attendeeEmails` em grupos de 200 e fazer queries paralelas

4. **Aplicar batch na query de profiles** (linhas 82-85 e 136-139):
   - Mesma logica para `bookedByIds` e `allBookedByIds` que tambem podem crescer

### Logica do batch

```text
function batchQuery(ids, batchSize=200):
  chunks = split ids into groups of batchSize
  results = await Promise.all(chunks.map(chunk => query.in(field, chunk)))
  return flatten(results)
```

### Arquivo modificado
- `src/hooks/useR1CloserMetrics.ts` -- adicionar batching em todas as queries `.in()`
