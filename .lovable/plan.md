

## Fix: Relatório de Análise de Carrinho — Dados + Mapa do Brasil

### Problema 1: Dados não aparecem
O hook filtra por `event_type IN ('purchase', 'PURCHASE')` mas os valores reais no banco são:
- `invoice.payment_succeeded` (2180)
- `NewSale` (1300)
- `kiwify.purchase_approved` (8)

Também filtra por `product_code` começando com `A0`, mas quase todos os registros têm `product_code = null`. O correto é filtrar por `product_category IN ('incorporador', 'contrato')` — que tem 866 registros em março.

### Problema 2: Análise por estado pouco legível
Substituir a tabela por um **mapa interativo do Brasil** (SVG) colorido por intensidade, mostrando a porcentagem de aproveitamento/perda por estado.

### Alterações

**1. `src/hooks/useCarrinhoAnalysisReport.ts`**
- Remover filtro `event_type IN ('purchase', 'PURCHASE')`
- Filtrar por `product_category IN ('incorporador', 'contrato')` 
- Excluir refunds: filtrar onde `event_type NOT IN ('refund', 'REFUND', 'chargeback')`
- Remover filtro por `product_code.startsWith('A0')` — usar product_category como critério
- Buscar refunds separadamente pelo email (manter lógica atual)

**2. `src/components/relatorios/BrazilMap.tsx`** (novo)
- Componente SVG do mapa do Brasil com os 27 estados
- Cada estado colorido por gradiente (verde → vermelho) baseado na taxa de perda
- Hover mostra tooltip com: UF, contratos, agendados, realizados, perdidos, % perda
- Clique no estado filtra a tabela detalhada abaixo

**3. `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`**
- Substituir a seção "Análise por Estado" (tabela) pelo componente `BrazilMap`
- Manter uma tabela resumida abaixo do mapa com os top 10 estados
- Melhorar legibilidade geral dos KPIs

### Detalhes técnicos
- SVG do Brasil com paths para cada UF (hardcoded, ~300 linhas)
- Escala de cor: `hsl(120, 70%, X%)` para verde (baixa perda) até `hsl(0, 70%, X%)` para vermelho (alta perda)
- Tooltip posicionado no cursor com `onMouseMove`
- Sem dependência externa — SVG puro + React state

