## Diagnóstico real (Abril/26)

Investigando a query de produção, descobri **dois problemas combinados**:

### Problema 1: `acq.classified` perde quase todas as parcerias
O hook `useChannelFunnelReport` usa `acq.classified` (vindo de `useAllHublaTransactions` → RPC `get_all_hubla_transactions`). Esse RPC tem o filtro:
```sql
AND NOT (ht.source = 'make' AND ht.sale_date >= '2026-04-01T00:00:00-03:00')
```
Isso exclui **95 das 98** transações com `product_category = 'parceria'` em Abril (todas vêm de `make`). Sobram só 3 → o número que você está vendo.

### Problema 2: A categoria 'parceria' não é a fonte real
As parcerias **reais** entram no Hubla como `product_category = 'incorporador'` (produtos A001, A005, A009, A000-Contrato). A linha `parceria` do Make era um espelho intermediário (descontinuado em Abril). Quando filtrei direto:

| Filtro | Emails únicos (Abril/26) |
|---|---|
| `product_category = 'parceria'` (apenas) | 82 (mas RPC corta para 3) |
| `product_category IN ('incorporador','parceria')` + sources reais | **222** primeiras conversões por email |
| Dessas, com R1 agendado nos últimos 90d | **156** |

O painel de Vendas Realizadas (~82) usa o CRM stage `Venda Realizada` — número intermediário entre os dois.

## Plano corrigido

**1 arquivo:** `src/hooks/useChannelFunnelReport.ts`

Trocar a fonte de `vendaFinal/faturamento` de `acq.classified` para uma **query direta** em `hubla_transactions` que:

a) Busca primeira conversão por email no período onde:
   - `product_category IN ('incorporador', 'parceria')`
   - `sale_status = 'completed'`
   - `source IN ('hubla', 'kiwify', 'manual', 'mcfpay')` *(exclui `make` que duplica)*
   - Email nunca teve compra dessas categorias antes (lookback 12 meses para garantir "primeira vez")

b) Para cada primeira conversão, faz match com R1 attendees por email/telefone (mesma lógica de `useAcquisitionReport`) para descobrir o canal (A010/ANAMNESE/OUTROS).

c) Quem não tem R1 → cai em "OUTROS" (compra direta sem passar pelo funil).

```ts
// Novo query no hook
const { data: firstParceriaConversions = [] } = useQuery({
  queryKey: ['funnel-first-parceria-conversions', startDate, endDate],
  queryFn: async () => {
    // 1. Buscar TODAS parcerias do período (incluindo upsells) p/ identificar primeira por email
    const { data: allInPeriod } = await supabase
      .from('hubla_transactions')
      .select('id, customer_email, customer_phone, product_price, net_value, sale_date')
      .in('product_category', ['incorporador', 'parceria'])
      .eq('sale_status', 'completed')
      .in('source', ['hubla', 'kiwify', 'manual', 'mcfpay'])
      .gte('sale_date', `${startDate}T00:00:00-03:00`)
      .lte('sale_date', `${endDate}T23:59:59-03:00`)
      .order('sale_date', { ascending: true })
      .limit(5000);

    // 2. Buscar emails que JÁ eram parceiros antes (lookback 12 meses) p/ excluir
    const lookbackStart = new Date(startDate);
    lookbackStart.setMonth(lookbackStart.getMonth() - 12);
    const { data: priorBuyers } = await supabase
      .from('hubla_transactions')
      .select('customer_email')
      .in('product_category', ['incorporador', 'parceria'])
      .eq('sale_status', 'completed')
      .in('source', ['hubla', 'kiwify', 'manual', 'mcfpay'])
      .gte('sale_date', lookbackStart.toISOString())
      .lt('sale_date', `${startDate}T00:00:00-03:00`)
      .limit(20000);

    const priorEmails = new Set((priorBuyers || []).map(r => r.customer_email?.toLowerCase()));

    // 3. Filtrar: primeira por email no período E nunca foi parceiro antes
    const seen = new Set<string>();
    const firstConversions = [];
    for (const tx of (allInPeriod || [])) {
      const email = tx.customer_email?.toLowerCase().trim();
      if (!email) continue;
      if (seen.has(email)) continue;
      if (priorEmails.has(email)) continue; // já era parceiro antes
      seen.add(email);
      firstConversions.push(tx);
    }
    return firstConversions;
  },
  enabled: !!startDate && !!endDate,
});
```

d) Para mapear canal, reutilizar `acq.emailToAttendees` / `acq.phoneToAttendees` (preciso expor esses maps no retorno do `useAcquisitionReport`) OU fazer query própria de R1 attendees no período.

**Solução mais simples e isolada:** fazer a query de R1 attendees direto no `useChannelFunnelReport` (mesmo código que `useAcquisitionReport` usa). Mantém os dois hooks independentes.

### Resultado esperado (Abril/26, BU Incorporador)
- Venda Final total: **~150-180** (alinhado com painel ~82, considerando que o painel filtra por estágio CRM enquanto isso usa Hubla pago)
- Faturamento Bruto: ~R$ 700k–R$ 900k
- Faturamento Líquido: ~R$ 400k–R$ 500k
- Distribuição por canal A010/ANAMNESE/OUTROS faz sentido

### Pergunta de confirmação
Antes de aprovar, confirma o escopo de **"primeira conversão"**:

1. **Estrita (recomendado):** Email **nunca** comprou parceria antes (lookback 12 meses). Conta apenas conversões 100% novas. → ~150 em Abril.
2. **Frouxa:** Apenas dedup dentro do período (não importa se já era parceiro antes). → ~222 em Abril.

A versão estrita reflete melhor "novos parceiros adquiridos pelo funil de Inside Sales" — recompras de quem já era parceiro são vendas, mas não são "conversão de funil".

### Escopo final
- 1 arquivo: `src/hooks/useChannelFunnelReport.ts` (substituir filtro do agregador)
- 1 ajuste de tooltip: `src/components/relatorios/ChannelFunnelTable.tsx`
- Sem mudanças em RPCs ou banco