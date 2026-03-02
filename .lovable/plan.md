
## Diagnóstico

Atualmente no `process-csv-imports`, a lógica de owner é:
1. `ownerEmail` (passado pelo job) → tem prioridade
2. `csvOwnerEmail` (coluna owner/user_email do CSV) → fallback
3. Se nenhum → `owner_id = null` → deal fica órfão

A função `get_next_lead_owner(p_origin_id uuid)` já existe no banco e implementa o rodízio por percentual — é a mesma usada por webhooks (Clint, Hubla, LIVE). Basta chamá-la via RPC quando não houver owner.

---

## O que mudar

### `supabase/functions/process-csv-imports/index.ts`

**Onde:** bloco de resolução de owner (linhas 210–222), dentro do loop `for (const csvDeal of chunkDeals)`

**Lógica nova:**
```
1. csvOwnerEmail = csvDeal.owner || csvDeal.dono || csvDeal.user_email
2. finalOwnerEmail = ownerEmail (job) || csvOwnerEmail (CSV)
3. SE finalOwnerEmail → atribuir normalmente (comportamento atual)
4. SE NÃO finalOwnerEmail E originId tem lead_distribution_config ativa:
   → chamar get_next_lead_owner(originId) via RPC
   → usar o retorno como owner_id
   → resolver owner_profile_id no profilesCache
```

Para evitar chamar o RPC N vezes (uma por deal, o que incrementaria o contador corretamente), cada deal sem owner chama `get_next_lead_owner` individualmente — isso é o comportamento correto do rodízio.

**Verificação prévia:** Antes do loop, checar se existe configuração ativa de distribuição para o `originId`:
```typescript
const { data: distConfig } = await supabase
  .from('lead_distribution_config')
  .select('id')
  .eq('origin_id', originId)
  .eq('is_active', true)
  .limit(1)
const hasDistribution = !!distConfig?.length
```

Só chamar o RPC se `hasDistribution = true`. Se não houver config, o deal fica sem owner (comportamento atual).

### `src/pages/crm/ImportarNegocios.tsx`

**Alterar o texto descritivo** do campo "Atribuir a (opcional)" para deixar claro que, se vazio e houver configuração de rodízio na pipeline selecionada, os leads serão distribuídos automaticamente.

```
texto atual: "Todos os deals importados serão atribuídos a este responsável"
texto novo:  "Se vazio, os leads serão distribuídos automaticamente via rodízio (se configurado na pipeline)"
```

---

## Arquivos a modificar
- `supabase/functions/process-csv-imports/index.ts` — lógica de owner no loop + verificação prévia de distConfig
- `src/pages/crm/ImportarNegocios.tsx` — texto descritivo do campo owner
