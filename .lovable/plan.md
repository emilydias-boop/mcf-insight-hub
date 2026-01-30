

# Plano de Limpeza e Otimização do Sistema

## Diagnóstico Realizado

Fiz uma varredura completa do sistema e identifiquei **3 categorias principais de problemas**:

| Categoria | Quantidade | Impacto |
|-----------|------------|---------|
| Hooks não utilizados | 8+ arquivos | Código morto, confusão |
| Edge functions obsoletas | 15+ funções | Deploy desnecessário, custos |
| Polling excessivo | 29 hooks com refetchInterval | Sobrecarga do banco de dados |

---

## 1. Hooks Órfãos (Não Utilizados)

Hooks criados mas **nunca importados** em nenhum componente:

| Arquivo | Última referência | Ação |
|---------|-------------------|------|
| `useDirectorKPIsFromMetrics.ts` | Nenhuma | REMOVER |
| `useSyncSdrKpis.ts` | Nenhuma | REMOVER |
| `useAgendamentosCreatedToday.ts` | Nenhuma | REMOVER |
| `useFunnelData.ts` | Apenas auto-referência | REMOVER |
| `useUpdateBookedAt.ts` | Nenhuma | REMOVER |

**Total: 5 hooks órfãos identificados**

---

## 2. Edge Functions de Correção One-Time

Functions criadas para correções pontuais que **não são mais necessárias**:

| Função | Propósito | Ação |
|--------|-----------|------|
| `fix-ads-cost` | Corrigir custo de ads específico | REMOVER |
| `fix-csv-orderbumps` | Processar order bumps de CSV | REMOVER |
| `fix-hubla-values` | Reprocessar valores Hubla | REMOVER |
| `fix-hubla-discrepancies` | Corrigir discrepâncias | REMOVER |
| `fix-reprocessed-activities` | Corrigir atividades | REMOVER |
| `backfill-deal-activities` | Preenchimento inicial | MANTER (pode ser útil) |
| `backfill-deal-owners` | Preenchimento inicial | MANTER (pode ser útil) |
| `backfill-deal-tasks` | Preenchimento inicial | MANTER (pode ser útil) |
| `backfill-orphan-owners` | Preenchimento inicial | MANTER (pode ser útil) |
| `reprocess-hubla-events` | Reprocessar eventos | AVALIAR (usado ocasionalmente?) |
| `reprocess-hubla-webhooks` | Reprocessar webhooks | AVALIAR (usado ocasionalmente?) |
| `reprocess-failed-webhooks` | Reprocessar falhas | MANTER (útil para erros) |
| `reprocess-failed-webhooks-cron` | Cron de reprocessamento | MANTER (automação) |
| `reprocess-missing-activities` | Reprocessar atividades | AVALIAR |
| `reprocess-contract-payments` | Reprocessar pagamentos | MANTER (usado recentemente) |

**Total: 5 functions para remover imediatamente, 4 para avaliar**

---

## 3. Otimização de Polling (refetchInterval)

### Problema Atual
29 hooks com `refetchInterval: 30000` (30 segundos) criando **~60 queries/minuto** por usuário.

### Classificação por Criticidade

| Nível | Intervalo Recomendado | Hooks |
|-------|----------------------|-------|
| **Alta** | 30s (manter) | `useWebhookLogs`, `useMeetingsPendentesHoje` |
| **Média** | 60s | `useR2MetricsData`, `useSdrMetricsV2`, `useCloserR2Metrics` |
| **Baixa** | 120s | `useWeeklyMetrics`, `useDirectorKPIs`, `useEvolutionData` |
| **Muito Baixa** | 300s | `useChairmanMetrics` (já está correto), `useCourseCRM` |

### Hooks para Ajustar

```text
30s → 60s:
- useR2MetricsData
- useSdrMetricsV2
- useSdrMetricsFromAgenda
- useCloserR2Metrics
- useSDRR2Metrics
- useCloserCarrinhoMetrics
- useSDRCarrinhoMetrics

30s → 120s:
- useWeeklyMetrics (2 lugares)
- useEvolutionData (remove refetch - dados históricos)
- useA010Sales
- useHublaTransactions (3 lugares)
- useUnlinkedTransactions
- useUnlinkedContracts
- useIncorporadorTransactions
- useR2CarrinhoVendas
- useAutomationLogs
- useCoursesSales
```

**Impacto estimado**: Redução de ~60% nas queries de polling

---

## 4. Resumo das Ações

### Fase 1: Remoção Imediata (Baixo Risco)

| Tipo | Arquivos | Ação |
|------|----------|------|
| Hooks órfãos | 5 arquivos | Deletar |
| Edge functions fix-* | 5 funções | Deletar e undeploy |

### Fase 2: Otimização de Performance

| Ação | Arquivos afetados |
|------|-------------------|
| Aumentar refetchInterval | ~20 hooks |
| Adicionar staleTime | Hooks que não têm |

### Fase 3: Avaliação Posterior

| Item | Decisão necessária |
|------|-------------------|
| Edge functions reprocess-* | Confirmar se ainda são usadas |
| Edge functions backfill-* | Manter para casos especiais |

---

## Arquivos a Remover

### Hooks (src/hooks/)
```text
useDirectorKPIsFromMetrics.ts
useSyncSdrKpis.ts
useAgendamentosCreatedToday.ts
useFunnelData.ts
useUpdateBookedAt.ts
```

### Edge Functions (supabase/functions/)
```text
fix-ads-cost/
fix-csv-orderbumps/
fix-hubla-values/
fix-hubla-discrepancies/
fix-reprocessed-activities/
```

---

## Arquivos a Modificar (Polling)

| Arquivo | Mudança |
|---------|---------|
| `useWeeklyMetrics.ts` | 30s → 120s |
| `useR2MetricsData.ts` | 60s → 90s |
| `useHublaTransactions.ts` | 30s → 60s |
| `useA010Sales.ts` | 30s → 60s |
| `useEvolutionData.ts` | Remover refetchInterval (dados históricos) |
| `useCoursesSales.ts` | 30s → 60s |
| `useIncorporadorTransactions.ts` | 30s → 60s |
| `useUnlinkedTransactions.ts` | 30s → 60s |
| `useUnlinkedContracts.ts` | 30s → 60s |
| `useR2CarrinhoVendas.ts` | 30s → 60s |
| `useCloserCarrinhoMetrics.ts` | 30s → 60s |
| `useSDRCarrinhoMetrics.ts` | 30s → 60s |
| `useCloserR2Metrics.ts` | 30s → 60s |
| `useSDRR2Metrics.ts` | 30s → 60s |
| `useSdrMetricsV2.ts` | 60s (já está) |
| `useSdrMetricsFromAgenda.ts` | 60s (já está) |
| `useAutomationLogs.ts` | 30s → 60s |

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Hooks órfãos | 5+ | 0 |
| Edge functions obsoletas | 5+ | 0 |
| Queries de polling/min | ~60 | ~25 |
| Tempo de carregamento | Lento | Mais rápido |
| Timeouts do banco | Frequentes | Raros |

---

## Observações Técnicas

1. **Não remover** edge functions de backfill - podem ser úteis para migrações futuras
2. **Manter** functions de reprocess-failed - são automações importantes
3. **Testar** após cada fase para garantir que nada quebrou
4. A limpeza de hooks órfãos é segura pois não há imports

