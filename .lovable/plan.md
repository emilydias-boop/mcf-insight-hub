

## Fix: Excluir arquivados e deduplicar por contato (alinhar dashboard com CRM)

### Diagnóstico confirmado

Dashboard tem **674**, CRM tem **668** = 6 leads a mais. Causa:

- **4 deals arquivados** (`archived_at IS NOT NULL`) com tag ANAMNESE — CRM esconde, dashboard mostra.
- **2 deals duplicados por contato** (Germana Luz Cataldo e Igor) — mesmo `contact_id` em pipelines diferentes; CRM conta 1x, dashboard conta 2x.

### Mudanças

**`src/hooks/useStageMovements.ts`**

1. **Filtrar arquivados em todas as queries de `crm_deals`**:
   ```ts
   .is('archived_at', null)
   ```
   Aplicar em: query de movimentações, query de deals criados no período, e na nova query de universo CRM-compatível.

2. **Deduplicar `totalUniqueLeads` por `contact_id`** (com fallback para `id` quando `contact_id` é null):
   ```ts
   const dedupeKey = (d: { id: string; contact_id: string | null }) =>
     d.contact_id ?? d.id;
   const matched = new Set<string>();
   batch.forEach((d) => {
     if (passesTagFilter({ tags: d.tags })) matched.add(dedupeKey(d));
   });
   ```

3. Selecionar `contact_id` junto com `id` e `tags` na query do universo.

### Resultado esperado

Com PILOTO ANAMNESE + INSIDE SALES + tag ANAMNESE:

| Métrica | Antes | Depois |
|---|---|---|
| Leads únicos no universo | 674 | **668** ✅ |
| Soma (passagens) | 1490 | ~1480 (sem arquivados) |
| Linhas por estágio | inclui arquivados | só ativos |

### Trade-off

- Linhas Acumulado/Passaram/Estão lá podem reduzir levemente quando há leads arquivados em algum estágio. É o comportamento correto e alinhado com o CRM.
- Dedupe por `contact_id` é aplicado **só** no contador "Leads únicos no universo". Nas linhas por estágio, cada deal continua sendo uma trajetória separada (Germana em INSIDE SALES + Germana em PILOTO ANAMNESE = 2 trajetórias).

### Escopo

- 1 arquivo (`src/hooks/useStageMovements.ts`)
- ~10 linhas
- Zero migration

