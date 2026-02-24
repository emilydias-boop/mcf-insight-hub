

## Substituir badge "Outside" por nome do produto no Consorcio

### Problema

No Kanban do Consorcio, o badge "$ Outside" nao agrega valor - o gestor quer ver **o que o lead comprou** (ex: "Contrato A009", "Contrato Efeito Alavanca"), nao apenas que ele e outside.

### Solucao

Mudar o `outsideMap` de `Map<dealId, boolean>` para `Map<dealId, { isOutside: boolean; productName: string | null }>`, e no card do Kanban, quando a BU for Consorcio, exibir o nome do produto em vez de "$ Outside".

### Alteracoes

**`src/hooks/useOutsideDetectionForDeals.ts`**

- Alterar a tipagem do retorno de `Map<string, boolean>` para `Map<string, { isOutside: boolean; productName: string | null }>`
- Na query de `hubla_transactions`, adicionar `product_name` ao `.select()`
- Guardar o `product_name` junto com a data do contrato no map intermediario
- No resultado final, incluir `productName` para cada deal outside

**`src/components/crm/DealKanbanBoard.tsx`**

- Atualizar tipagem de `outsideMap` para o novo formato
- Passar `outsideInfo` (com `productName`) para `DealKanbanCard` em vez de apenas `isOutside`

**`src/components/crm/DealKanbanCard.tsx`**

- Alterar prop `isOutside` para `outsideInfo?: { isOutside: boolean; productName: string | null }`
- No badge, se `productName` existir, mostrar o nome do produto (ex: "Contrato A009") em vez de "$ Outside"
- Manter o estilo amarelo para indicar visualmente que e uma compra pre-existente

**`src/pages/crm/Negocios.tsx`**

- Ajustar a leitura do `outsideMap` para o novo formato nas partes de filtro (onde faz `outsideMap.get(deal.id)`)
- O filtro de Outside continua funcionando, usando `outsideInfo.isOutside`

### Resultado esperado

- BU Incorporador: Badge mostra o nome do produto comprado (ex: "$ Contrato MCF") - mais informativo
- BU Consorcio: Badge mostra o nome do produto comprado (ex: "$ Contrato Efeito Alavanca")
- Filtros de Outside continuam funcionando normalmente
- Se o product_name nao estiver disponivel, fallback para "$ Outside" como antes

