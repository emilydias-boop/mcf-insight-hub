

## Plano: Backfill correto dos 75 leads A010 faltantes

### Problema
O backfill anterior usava filtros incorretos que excluíam leads com contrato, leads de outras pipelines e leads com contatos duplicados. O número real é **75** (não 53).

### Solução
Atualizar a lógica do `backfill-a010-missing-deals` para remover os filtros excessivos e executar com `days_back: 90`.

### Mudanças

| Arquivo | O que fazer |
|---------|-------------|
| `supabase/functions/backfill-a010-missing-deals/index.ts` | Remover qualquer lógica que pule leads com contrato A000 ou leads com deals em outras pipelines. O único filtro de exclusão deve ser: (1) já tem deal no PIS, (2) é parceiro. Para contatos duplicados, usar o primeiro contato encontrado. |

### Execução
1. Deploy da função atualizada
2. Rodar com `dry_run: true, days_back: 90` para confirmar os 75
3. Rodar com `dry_run: false, days_back: 90` para criar os deals

### Detalhes técnicos
- A função atual já tem a lógica correta (só filtra parceiros e deals existentes no PIS)
- O problema era na análise manual anterior, não no código
- Basta executar com `days_back: 90` em vez de `days_back: 7`

