

## Limpeza: Remover parceiros do backfill

### Problema
O backfill criou 21 deals para contatos que já são parceiros (compraram A001, A004, A009, Parceria, etc.). Os webhooks normais bloqueiam esses leads via `checkIfPartner`, mas o backfill não tinha essa verificação.

### Solução (2 partes)

**1. Remover os 21 deals de parceiros do pipeline Inside Sales**

Criar e executar uma edge function temporária `cleanup-backfill-partners` que:
- Busca deals com tag `Backfill-Offer`
- Cruza com `hubla_transactions` onde `product_category IN ('parceria', 'incorporador')`
- Registra esses 21 contatos na tabela `partner_returns` (para rastreabilidade)
- Deleta os 21 deals do pipeline

**2. Corrigir o backfill para o futuro**

Adicionar a verificação de parceiro no `backfill-a010-offer-leads/index.ts`, antes de criar o deal:
```typescript
// Check if contact is a partner
const { data: partnerCheck } = await supabase
  .from('hubla_transactions')
  .select('id')
  .ilike('customer_email', email)
  .in('product_category', ['parceria', 'incorporador'])
  .limit(1)
  .maybeSingle();

if (partnerCheck) {
  // Register in partner_returns and skip
  stats.skipped_partners++;
  continue;
}
```

### Impacto
- **Antes**: 169 deals no pipeline
- **Depois**: 148 deals legítimos (169 - 21 parceiros)
- Os 21 parceiros ficam registrados em `partner_returns` para auditoria

### Arquivos alterados
- `supabase/functions/cleanup-backfill-partners/index.ts` (novo, temporário)
- `supabase/functions/backfill-a010-offer-leads/index.ts` (adicionar verificação de parceiro)

