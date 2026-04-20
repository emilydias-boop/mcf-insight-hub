

## Aumentar limite de movimentações para 10.000 (sem impacto colateral)

### Mudança

**Arquivo único:** `src/hooks/useStageMovements.ts`

1. Trocar `.limit(5000)` por `.limit(10000)` na query de `deal_activities`.
2. Adicionar warning no console quando o retorno bater no teto, sinalizando dados potencialmente cortados:
   ```ts
   if (activities.length === 10000) {
     console.warn('[useStageMovements] Limite de 10.000 atingido — encurte o período ou filtre por pipeline para ver tudo.');
   }
   ```
3. Manter o `console.info` de diagnóstico já existente.

### Garantias de isolamento

- **Hook usado em 1 lugar só**: página `/crm/movimentacoes`. Verificado por busca no codebase.
- **Zero migration**, zero RLS, zero schema change.
- **Zero impacto** em KPIs, Fechamento, Carrinho R2, Agenda, atribuição de SDR, payouts ou qualquer outro cálculo — esses sistemas usam tabelas e queries totalmente separadas.
- **Zero efeito em performance de outras telas** — a query só roda quando o usuário abre `/crm/movimentacoes`.
- **Mesma agregação, mesmos filtros, mesma UI** — só sobe o teto de leitura.

### Limites conhecidos (aceitos)

- Pipelines de altíssimo volume (Consórcio) ainda podem cortar dados acima de ~60 dias.
- Visão "todas as pipelines" pode cortar acima de ~30 dias.
- Quando isso ocorrer, console exibe warning explícito.

### Validação

1. `/crm/movimentacoes`, Inside Sales, últimos 90 dias → todas as stages aparecem
2. Console mostra `[useStageMovements] { activities: ~7000, dealsAfterFilter: ..., rows: ... }` sem warning
3. Outras telas (KPIs, Fechamento, Carrinho) continuam funcionando idênticas
4. Performance percebida: ~1.5-2s no carregamento da página de Movimentações

### Escopo

- 1 arquivo editado, ~3 linhas alteradas
- Zero dependências, zero migrations, zero mudanças de UI

