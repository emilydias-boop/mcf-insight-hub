

## Fix: Coluna "Acumulado" deve deduplicar por contato (igual ao CRM)

### Diagnóstico

A coluna **Acumulado** soma 684 (442+60+180+2) enquanto o CRM mostra 669. A diferença vem de:

- O **Acumulado** é montado em `Set<dealId>` (`uniqueLeads.add(dealId)`) — conta cada deal separadamente.
- Quando o mesmo **contato** existe em 2 pipelines (Germana Luz Cataldo, Igor + outros casos), os 2 deals contam nos 2 estágios em que aparecem, inflando cada linha.
- "Leads únicos no universo" já foi corrigido para deduplicar por `contact_id` (= 669). A coluna Acumulado ficou para trás.

### Mudança

**`src/hooks/useStageMovements.ts`** (~5 linhas)

Trocar a chave do `Set<string>` em `uniqueLeads` de `dealId` para `contactKey = contact_id ?? dealId`. Locais a ajustar:

1. **Linha ~432** (movimentações):
   ```ts
   const contactKey = deal.contact_id ?? deal.id;
   if (!e.uniqueLeads.has(contactKey)) e.uniqueLeads.add(contactKey);
   ```

2. **Linha ~469** (snapshot):
   ```ts
   const contactKey = deal.contact_id ?? deal.id;
   e.uniqueLeads.add(contactKey);
   ```

3. **Linhas ~493-505** (acumulado via histórico) — usar `contact_id` do deal (lookup em `filteredDealsMap`):
   ```ts
   stagesPassedByDeal.forEach((stagesSet, dealId) => {
     const deal = filteredDealsMap.get(dealId);
     const contactKey = deal?.contact_id ?? dealId;
     stagesSet.forEach((stageKey) => {
       // ... ensureEntry(...)
       e.uniqueLeads.add(contactKey);
     });
   });
   ```

### Resultado esperado

Com PILOTO ANAMNESE + INSIDE SALES + tag ANAMNESE:

| Estágio | Antes | Depois |
|---|---|---|
| ANAMNESE INCOMPLETA | 442 | ~440 |
| Lead Gratuito | 60 | 60 |
| Novo Lead | 180 | ~179 |
| Lead Instagram | 2 | 2 |
| **Soma das linhas** | **684** | **≤ 669** ✅ |
| Leads únicos no universo | 669 | 669 |

A soma vertical pode continuar > 669 se um mesmo contato aparece em estágios diferentes (ex.: Germana passou por "Novo Lead" e "Anamnese Incompleta") — isso é correto, pois é o conceito da coluna. Mas nenhuma linha individual passará do total do CRM.

### Trade-off

Mantém o comportamento de "mesmo contato em 2 pipelines = 1 entrada por estágio", alinhando com a forma do CRM contar oportunidades únicas por contato.

### Escopo

- 1 arquivo, ~5 linhas
- Zero migration, zero mudança em queries

