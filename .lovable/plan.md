<final-text>## Diagnóstico

Do I know what the issue is? Sim.

O problema restante é principalmente de front/dado derivado: o lead entra na safra atual por `carrinho_week_start`, mas continua sendo exibido pela data histórica `scheduled_at`.

Hoje o fluxo está assim:
- `useEncaixarNoCarrinho.ts` grava `carrinho_week_start`
- `useR2CarrinhoData.ts` ainda devolve `scheduled_at` original da reunião
- `R2AgendadasList.tsx`, `R2AprovadosList.tsx` e `filterByCarrinho` usam esse `scheduled_at` para agrupar, filtrar e ordenar

Resultado: o lead aparece na safra certa “logicamente”, mas visualmente continua caindo em 30/03, 01/04 etc. Por isso parece que está na semana errada.

## Plano

### 1. Separar data real da reunião da data de exibição no carrinho
**Arquivo:** `src/hooks/useR2CarrinhoData.ts`

- Adicionar um campo derivado, por exemplo `display_scheduled_at`
- Regra:
  - lead normal: `display_scheduled_at = scheduled_at`
  - lead encaixado na safra atual: `display_scheduled_at` vira uma data dentro da semana do encaixe, preservando dia da semana/horário quando possível
- Manter `scheduled_at` original intacto para histórico e auditoria

### 2. Fazer a UI inteira do Carrinho usar a data derivada
**Arquivos:**  
- `src/components/crm/R2AgendadasList.tsx`
- `src/components/crm/R2AprovadosList.tsx`
- `src/pages/crm/R2Carrinho.tsx`

- Agrupar dias por `display_scheduled_at`
- Ordenar por `display_scheduled_at`
- Filtro “Todas Datas” por `display_scheduled_at`
- `filterByCarrinho(... item => ...)` também deve usar `display_scheduled_at`

Assim, um encaixe da safra 09/04–15/04 deixa de aparecer sob 30/03 e passa a aparecer de fato dentro dessa safra.

### 3. Preservar contexto sem confundir a semana
**UI**
- Manter o badge `Encaixado`
- Mostrar a data original apenas como informação secundária, não como chave de agrupamento
  - ex.: tooltip, subtítulo pequeno ou drawer

### 4. Validar se existe sujeira histórica no banco
**Checagem pontual**
- Conferir os leads do print no banco
- Se algum estiver com `carrinho_week_start` realmente incorreto, fazer limpeza pontual além do ajuste de front
- Se estiverem corretos no banco, a correção fica só na camada de exibição

## Resultado esperado

Depois desse ajuste:
- o lead continua pertencendo à safra do encaixe
- ele deixa de aparecer visualmente em semanas antigas
- a lista, filtros e carrinhos param de usar a data histórica como referência de safra
- o histórico real da reunião não é perdido

## Detalhes técnicos

Arquivos principais:
- `src/hooks/useR2CarrinhoData.ts`
- `src/pages/crm/R2Carrinho.tsx`
- `src/components/crm/R2AgendadasList.tsx`
- `src/components/crm/R2AprovadosList.tsx`

Ponto-chave da correção:
- não alterar `meeting_slot.scheduled_at` no banco
- apenas introduzir um campo de exibição específico para o Carrinho R2</final-text>