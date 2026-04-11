

# Plano: Sync automatico e non-blocking + investigar valores enormes

## Diagnostico

### 1. Sync bloqueia a tela
O hook `useSyncBillingFromHubla` executa um loop `while(hasMore)` no frontend, fazendo chamadas sequenciais a edge function. Enquanto roda, o botao mostra "Sincronizando..." e o usuario nao pode sair sem perder o progresso. Com ~1800+ transacoes processadas em batches de 200, isso leva varios minutos.

### 2. Valores enormes
A sync **ainda esta rodando** (logs mostram `nextOffset: 1800, hasMore: true`). Alguns valores ja foram corrigidos mas nem todos os registros foram processados. Alem disso, existe um problema estrutural: quando ha multiplas transacoes P1 com `product_price` diferentes para o mesmo email+produto (ex: Breno Salgado tem P1 com 25.086, 20.997 e 19.500), o `first` depende da ordenacao e pode pegar o valor errado.

## Correcoes propostas

### A. Sync non-blocking no frontend
Mudar o hook para disparar a sync como "fire-and-forget" com toast de progresso, ao inves de bloquear a UI:

**`src/hooks/useSyncBillingFromHubla.ts`**:
- Disparar a primeira chamada e mostrar toast
- Processar batches com `toast.loading` mostrando progresso (offset atual)
- Usar `mutateAsync` em background sem bloquear navegacao
- Se o usuario sair da pagina, a sync continua normalmente (cada chamada e independente)

### B. Sync automatico via pg_cron
Criar um cron job que roda a sync automaticamente a cada 6 horas, eliminando a necessidade de clicar no botao:

- Usar `pg_cron` + `pg_net` para invocar `sync-billing-from-hubla` periodicamente
- Cada invocacao processa 200 transacoes; o cron roda a cada 6h para manter dados atualizados

### C. Corrigir selecao do `product_price` para P1
Quando ha multiplas transacoes P1, usar a mediana do `product_price` (excluindo outliers) ao inves do primeiro valor:

**`supabase/functions/sync-billing-from-hubla/index.ts`**:
- Antes de calcular `valorBruto`, filtrar transacoes com `installment_number=1`
- Se houver multiplas, usar o valor mais frequente (moda) do `product_price`
- Isso evita que um valor anomalo (como 25.086 vs 19.500) distorca o `valor_total_contrato`

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useSyncBillingFromHubla.ts` | Tornar sync non-blocking com toast de progresso |
| `supabase/functions/sync-billing-from-hubla/index.ts` | Corrigir selecao do product_price quando ha multiplas P1 |
| SQL (via insert tool) | Criar cron job pg_cron para sync automatico a cada 6h |

## Detalhes tecnicos

### Non-blocking sync
```typescript
// Hook dispara batches em background
mutationFn: async () => {
  const toastId = toast.loading('Sincronizando...');
  // loop com toast.loading update a cada batch
  // se erro, toast.error; se sucesso, toast.success
  // invalidateQueries ao final
}
```

### Cron job
```sql
select cron.schedule(
  'sync-billing-hubla-auto',
  '0 */6 * * *',
  $$ select net.http_post(
    url:='https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/sync-billing-from-hubla',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body:='{"batchSize":20,"skipSingleTx":true}'::jsonb
  ) $$
);
```

Nota: o cron processa apenas 200 transacoes por invocacao. Para cobrir todas as transacoes, a edge function precisara de logica de auto-paginacao (detectar offset pendente e continuar).

### Selecao de product_price
```typescript
// Ao inves de first.product_price, usar moda das P1
const p1Txs = txList.filter(tx => (tx.installment_number || 1) === 1);
const prices = p1Txs.map(tx => tx.product_price || 0);
const valorBruto = prices.length > 1
  ? prices.sort((a,b) => a-b)[Math.floor(prices.length/2)] // mediana
  : (first.product_price || 0);
```

