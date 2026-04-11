

# Plano: Detecção de Outside via offer_name

## Ofertas que identificam Outside

Apenas contratos com estas duas ofertas podem ser Outside:
1. `Contrato - Curso R$ 97,00`
2. `Contrato Perfil A - Vitrine A010`

Todas as outras ofertas (CLS-XX, MCF, Caução, Sócio, etc.) NÃO são Outside.

## Regra completa (validada em abril com 0 falsos positivos)

Um contrato é **OUTSIDE** somente se:
1. Offer = `"Contrato - Curso R$ 97,00"` OU `"Contrato Perfil A - Vitrine A010"`
2. **E** NÃO é RECO (sem contrato A000 anterior ao período)
3. **E** NÃO tem oferta `Contrato CLS%` para o email (closer)
4. **E** NÃO comprou A010 antes do contrato (inside sales)
5. **E** contrato ANTES da R1 ou SEM R1

## Implementação (3 passos)

### Passo 1: Fix webhook -- offer_name extraction
**Arquivo:** `supabase/functions/hubla-webhook-handler/index.ts`

Adicionar `body.event.products` como fonte primária:
```typescript
const offerNameNoItems = body.event?.products?.[0]?.offers?.[0]?.name 
  || invoice?.products?.[0]?.offers?.[0]?.name || null;
```

### Passo 2: Backfill offer_name via migration SQL
```sql
UPDATE hubla_transactions
SET offer_name = raw_data->'event'->'products'->0->'offers'->0->>'name'
WHERE offer_name IS NULL
AND raw_data->'event'->'products'->0->'offers'->0->>'name' IS NOT NULL;
```

### Passo 3: Atualizar 3 hooks de detecção

**Arquivos:**
- `src/hooks/useSdrOutsideMetrics.ts`
- `src/hooks/useOutsideDetectionForDeals.ts`
- `src/hooks/useOutsideDetection.ts`

Alterações em cada hook:
1. Buscar `offer_name` junto com contratos (adicionar campo na query)
2. Filtrar: só considerar contratos com offer = `Contrato - Curso R$ 97,00` ou `Contrato Perfil A - Vitrine A010`
3. Adicionar check de RECO: buscar se email tem contrato A000 antes do período
4. Adicionar check de CLS: buscar se email tem oferta `Contrato CLS%`
5. Adicionar check de A010: buscar se email comprou A010 antes do contrato
6. Manter lógica existente de data (contrato antes R1)

### Nota sobre matching de email

A simulação revelou que emails com typos no CRM (ex: `rockrtmaol.com` vs `rocketmail.com`) impedem o match. Isso é uma limitação conhecida, mas o lead seria classificado corretamente como NORMAL se o email batesse (contrato após R1). Não será tratado neste escopo.

```text
Fluxo de decisão:
  Email tem contrato A000 no período?
    └─ Offer ≠ "Curso R$ 97,00" e ≠ "Perfil A - Vitrine A010"? → IGNORAR
    └─ Tem oferta "Contrato CLS%"? → NÃO é Outside
    └─ É recompra? → NÃO é Outside  
    └─ Comprou A010 antes? → NÃO é Outside
    └─ Contrato antes da R1 ou sem R1? → OUTSIDE ✓
    └─ Contrato depois da R1? → NORMAL
```

