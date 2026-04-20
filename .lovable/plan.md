

## Reescrever a contagem de A010 para usar a fonte de verdade (Hubla)

### Diagnóstico

Você está certo: **A010 é venda da Hubla**, não tag do CRM. Hoje o funil conta A010 a partir de tags em `crm_deals` (`tags @> 'A010'`), o que sub/super-conta porque:

- Nem todo comprador A010 tem a tag aplicada no deal (depende de webhook + sync ter rodado)
- Tags ficam no deal, mas a venda real vive em `hubla_transactions` com `product_category = 'a010'` e `sale_status = 'completed'`
- Existe inclusive um hook dedicado pra isso: `useBulkA010Check` que cruza email do contato com `hubla_transactions`

A fonte de verdade do "lead é A010" é: **existe transação Hubla com `product_category='a010'` e `sale_status='completed'` cujo `customer_email` (ou phone) bate com o contato do deal.**

### Mudança no `useBUFunnelComplete.ts`

**1. Buscar compradores A010 da Hubla no período** (uma query nova):
```ts
const { data: a010Buyers } = await supabase
  .from('hubla_transactions')
  .select('customer_email, customer_phone, sale_date')
  .eq('product_category', 'a010')
  .eq('sale_status', 'completed')
  .gte('sale_date', startDate)
  .lte('sale_date', endDate);

const a010EmailSet = new Set(a010Buyers.map(b => b.customer_email?.toLowerCase()).filter(Boolean));
const a010PhoneSet = new Set(a010Buyers.map(b => normalizePhone(b.customer_phone)).filter(Boolean));
```

**2. Reescrever `classifyChannelStrict`** para que A010 seja decidido pela Hubla, não pela tag:
```ts
function classifyChannelStrict(deal): string {
  const email = deal.contact?.email?.toLowerCase();
  const phone = normalizePhone(deal.contact?.phone);
  
  // A010 = comprador Hubla A010 (fonte de verdade)
  if ((email && a010EmailSet.has(email)) || (phone && a010PhoneSet.has(phone))) {
    return 'A010';
  }
  
  // ANAMNESE = webhook + tag exata "ANAMNESE" (já implementado)
  if (deal.data_source === 'webhook' && exactTags.includes('ANAMNESE')) return 'ANAMNESE';
  if (exactTags.includes('ANAMNESE-INSTA')) return 'ANAMNESE-INSTA';
  
  // Demais canais
  return classifyChannel({...}) || 'OUTRO';
}
```

**3. Garantir que `crm_contacts.email` e `phone` venham no select de `crm_deals`** (verificar — se já vêm, sem mudança; senão, adicionar `crm_contacts(email, phone)` no select).

### Comportamento resultante

| Métrica | Antes | Depois |
|---|---|---|
| A010 do funil | Deals com tag `A010` no CRM (frouxo, depende de sync) | Deals cujo contato comprou A010 na Hubla no período (fonte de verdade) |
| Universo A010 (mês) | Variável conforme tag aplicada | ~490 (bate com Hubla) |
| Vendas Finais A010 | Deals A010 com contrato pago | Mesmo critério, mas universo correto |
| ANAMNESE | Inalterado (webhook + tag exata) | Inalterado |
| OUTRO | Tudo que não é A010 nem ANAMNESE | Idem |

### Detalhes importantes

- **Período do A010**: usar `sale_date` da Hubla dentro do período do funil. Comprou A010 fora da janela → não conta como A010 nesse período (mesmo critério dos outros canais).
- **Conflito A010 + ANAMNESE**: se um lead é simultaneamente comprador A010 (Hubla) E veio por webhook ANAMNESE, **A010 vence** (regra de prioridade já usada em `useBulkA010Check` e na lógica de roteamento Hubla — memory `hubla-routing-collision-logic-v5`). Match direto com o que já existe no app.
- **Match phone**: usar últimos 9 dígitos (mesma normalização do app, memory `crm-manual-entry-deduplication-standard`).

### Escopo

- 1 arquivo: `src/hooks/useBUFunnelComplete.ts`
- ~40 linhas (1 query nova + reescrita do `classifyChannelStrict` + sets de match)
- 0 migration

### Confirmar antes de implementar

1. **Janela do comprador A010**: contar como A010 quem comprou **dentro do período do funil** (recomendado, simétrico com os outros canais), ou **qualquer comprador A010 histórico** (universo cumulativo)?

