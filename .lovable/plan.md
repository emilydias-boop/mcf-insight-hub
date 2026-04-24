## Plano Final — Refinamento da Venda Final no Funil por Canal

Arquivo único: **`src/hooks/useChannelFunnelReport.ts`**

### Decisões confirmadas pelo usuário
1. ✅ **Excluir A000 - Contrato** (são parcelas mensais da pré-reserva, não venda nova) — e qualquer produto que não seja parceria de fato
2. ✅ **Excluir renovações** (A006, A009 - Renovação Parceiro MCF, R005 - Anticrise Completo etc.)
3. ✅ **Tudo que vem do Hubla é tratado como Líquido** → o valor pago pelo cliente vai para `faturamentoLiquido`. O `faturamentoBruto` é calculado a partir do `reference_price` configurado em `product_configurations`.
4. ✅ **Se passou por R1 e foi reconhecido, ele é canal** — usar a presença em `meeting_slot_attendees` como sinal mesmo quando as tags estão vazias.

### Diagnóstico (Abril/26 — dados reais)

Produtos encontrados em parcerias do período:

| Produto | Qtd | Conta como Venda? |
|---|---|---|
| A000 - Contrato | 301 | ❌ parcela mensal |
| A000 - Contrato MCF | 1 | ❌ parcela mensal |
| Contrato - Sócio MCF | 1 | ❌ parcela mensal |
| A001 - MCF INCORPORADOR COMPLETO | 68 | ✅ venda nova |
| A009 - MCF INCORPORADOR COMPLETO + THE CLUB | 38 | ✅ venda nova |
| A005 - MCF P2 | 35 | ✅ venda nova |
| A009 - Renovação Parceiro MCF | 4 | ❌ renovação |
| A004 - MCF Plano Anticrise Básico | 2 | ✅ (anticrise é venda nova) |
| A008 - The CLUB | 1 | ❌ produto auxiliar |

**Após filtros:** ~143 transações (antes da deduplicação por email/12m). Após dedup, deve ficar próximo dos **~82 do painel de Vendas Realizadas**.

### Mudanças concretas no hook

#### 1. Lista branca de produtos que contam como Venda Final
Reaproveitar `ALLOWED_BILLING_PRODUCTS` de `src/constants/billingProducts.ts` (já existe e segue exatamente o mesmo critério usado no relatório de Faturamento):
```ts
import { ALLOWED_BILLING_PRODUCTS } from '@/constants/billingProducts';
```
Lista atual:
- A001 - MCF INCORPORADOR COMPLETO
- A009 - MCF INCORPORADOR COMPLETO + THE CLUB
- A009 - MCF INCORPORADOR + THE CLUB
- A003 - MCF Plano Anticrise Completo
- A004 - MCF Plano Anticrise Básico
- A002 - MCF INCORPORADOR BÁSICO

Vou também incluir **A005 - MCF P2** (vi 35 ocorrências em abril; é P2 = pacote de parceria).

#### 2. Map de reference_price (para calcular o BRUTO)
Adicionar query nova:
```ts
const { data: refPrices } = useQuery({
  queryKey: ['product-ref-prices'],
  queryFn: async () => {
    const { data } = await supabase
      .from('product_configurations')
      .select('product_name, reference_price')
      .in('product_category', ['incorporador','parceria'])
      .eq('is_active', true);
    const map = new Map<string, number>();
    (data || []).forEach(r => map.set(r.product_name, Number(r.reference_price) || 0));
    return map;
  },
  staleTime: 5 * 60_000,
});
```

#### 3. Query de parcerias — incluir `product_name` e filtrar pela whitelist
```ts
.select('id, customer_email, customer_phone, product_name, product_price, sale_date')
// após buscar:
.filter(tx => ALLOWED_BILLING_PRODUCTS.includes(tx.product_name) || tx.product_name === 'A005 - MCF P2')
```

#### 4. Cálculo de Bruto e Líquido por transação
```ts
pending.push({
  id: tx.id,
  email,
  phone: phoneSuffix(tx.customer_phone),
  product_name: tx.product_name,
  liquido: Number(tx.product_price) || 0,           // o que veio do Hubla é o líquido
  bruto: refPrices.get(tx.product_name) || Number(tx.product_price) || 0, // reference_price
});
```
No agregador:
```ts
slot.vendaFinal++;
slot.faturamentoBruto += p.bruto;
slot.faturamentoLiquido += p.liquido;
```

#### 5. Classificação por canal — "passou por R1 = é canal"
A lógica atual já usa R1 attendees (email + telefone), mas só lê `tags`. Vou ajustar para:

a) **Manter:** se houver tags claras → A010 / ANAMNESE
b) **Adicionar fallback:** se o lead foi encontrado em R1 attendee mas as tags estão vazias/genéricas → consultar também `crm_deals.origin_id` e o `crm_pipelines.name` para identificar pipeline (ex: "INSIDE SALES A010" → A010, "ANAMNESE" → ANAMNESE).
c) Apenas se **nem R1 attendee nem origem** identificarem o canal → cai em OUTROS.

Implementação: enriquecer a query de attendees com `crm_deals.origin_id` e fazer JOIN com `crm_pipelines(name)`. A função `classifyByTags` vira `classifyByDeal({ tags, pipelineName })`:
```ts
const classifyByDeal = (tags: string[], pipelineName: string): string => {
  if (tags.some(t => t.includes('A010'))) return 'A010';
  if (tags.some(t => t.includes('ANAMNESE') || t.includes('LIVE') || t.includes('LANÇ') || t.includes('LANC'))) return 'ANAMNESE';
  // fallback por pipeline
  const p = (pipelineName || '').toUpperCase();
  if (p.includes('A010')) return 'A010';
  if (p.includes('ANAMNESE') || p.includes('LIVE') || p.includes('LANÇ')) return 'ANAMNESE';
  // tinha R1 attendee mas pipeline genérica → ainda assim conta como canal "ANAMNESE"
  // (passou pelo funil, regra do usuário)
  return 'ANAMNESE';
};
```
**Importante:** se o email/phone NÃO foi encontrado em nenhum R1 attendee, aí sim vai para OUTROS (compra direta sem passar pelo funil).

### Resultado esperado (Abril/26)

| Métrica | Atual | Esperado |
|---|---|---|
| Venda Final Total | 173 (com lixo) | ~80–95 (alinhado ao painel) |
| Faturamento Bruto | R$ 204k (preços Hubla) | ~R$ 1,0M (reference_price × qtd) |
| Faturamento Líquido | ~R$ 204k (incorreto) | ~R$ 600k (o que entrou no Hubla) |
| Distribuição por canal | quase tudo OUTROS | A010 + ANAMNESE recebem corretamente |

### Tooltip
Atualizar texto em `src/components/relatorios/ChannelFunnelTable.tsx`:
> "Primeira compra de parceria do cliente no período (deduplicado por email, lookback 12 meses). Considera apenas produtos de parceria/incorporador (A001/A002/A003/A004/A005/A009). Bruto = preço de referência cadastrado. Líquido = valor recebido no Hubla."

### Escopo
- 1 arquivo principal: `src/hooks/useChannelFunnelReport.ts`
- 1 ajuste de tooltip: `src/components/relatorios/ChannelFunnelTable.tsx`
- Sem mudanças em RPCs, banco ou outros relatórios
