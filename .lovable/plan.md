

## Trocar "Venda Final" do Funil por Canal para refletir conversão em **Parceria**

### Diagnóstico
Hoje, na tabela **Funil por Canal**, a coluna **Venda Final** soma **todas** as `hubla_transactions` pagas no período (1018 em Abril/26, R$ 868k bruto), incluindo A010, Vitalício, Contrato, Renovação, etc.

Isso quebra a lógica do funil: o objetivo do funil de Inside Sales é medir **quantos leads viraram parceiros** (produtos `product_category = 'parceria'` — Incorporador A001/A009/A002, Anticrise, etc.). As outras categorias (A010, Vitalício, Contrato) são produtos de entrada/automáticos, não a venda final do funil.

### Dados confirmados (Abril/26, todas BUs)
| product_category | Transações | Bruto | Líquido |
|---|---|---|---|
| **parceria** | **100** | **R$ 705.281** | **R$ 544.215** |
| a010 | 1117 | R$ 54.685 | R$ 41.374 |
| incorporador | 451 | R$ 1.219.263 | R$ 491.569 |
| ob_vitalicio | 366 | R$ 38.200 | R$ 17.874 |
| outros | … | … | … |
| **TOTAL pago** | **2706** | — | — |

(Os 1018 atuais vêm de um filtro intermediário que não isola parceria.)

### Mudança proposta
Arquivo único: `src/hooks/useAcquisitionReport.ts` — **não muda** (mantém KPIs do topo iguais).

Arquivo: `src/hooks/useChannelFunnelReport.ts` — alterar a fonte de `vendaFinal`, `faturamentoBruto`, `faturamentoLiquido` no agregador (linhas 192-198) para considerar **apenas** transações com `product_category = 'parceria'`:

```ts
acq.classified
  .filter(({ tx }) => (tx.product_category || '').toLowerCase() === 'parceria')
  .forEach(({ channel, gross, net }) => {
    const ch = normalizeFunnelChannel(channel);
    const slot = get(ch);
    slot.vendaFinal++;
    slot.faturamentoBruto += gross || 0;
    slot.faturamentoLiquido += net || 0;
  });
```

### Tooltip
Atualizar `ChannelFunnelTable.tsx` linha 104:
> "Conversões em **Parceria** no período (`product_category = 'parceria'`) — produtos Incorporador (A001/A009/A002) e Anticrise. Mede quantos leads do canal viraram parceiros, ignorando vendas de produtos de entrada como A010 ou Contrato."

### Resultado esperado (Abril/26, BU Incorporador)
- **Venda Final (total)**: 1018 → **~100** (apenas parcerias)
- **Fat. Bruto (total)**: R$ 868k → **~R$ 705k**
- **Fat. Líquido (total)**: R$ 647k → **~R$ 544k**
- Conversões `Aprovado → Venda` e `Entrada → Venda` ficam realistas (hoje 727,1% por contar transações irrelevantes).
- Os 4 cards do topo (Total Transações 1018 / Faturamento R$ 868k / etc.) **continuam iguais** — eles representam o universo total de receita, não o funil.

### Escopo
- 1 arquivo: `src/hooks/useChannelFunnelReport.ts` (filtro `parceria` no `acq.classified`)
- 1 ajuste de texto: `src/components/relatorios/ChannelFunnelTable.tsx` (tooltip)
- Sem mudança em RPCs, banco ou outras páginas.

### Pergunta de confirmação
Confirma que **só `product_category = 'parceria'`** deve contar como "Venda Final"? Ou quer incluir também `incorporador` (que tem 451 txs e provavelmente representa adicionais/upsells de parceiros já existentes)?

