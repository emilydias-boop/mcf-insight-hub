

## Fix: Canal mostra apenas LIVE/A010 — falta OUTSIDE, LANÇAMENTO e ANAMNESE

### Causa raiz (3 bugs distintos)

1. **LANÇAMENTO nunca dispara**: A query de contratos (linha 304) não inclui `sale_origin`. O código só verifica `product_name.includes('contrato mcf')`, mas todos os contratos se chamam "A000 - Contrato". O campo `sale_origin = 'launch'` existe no banco mas nunca é lido.

2. **OUTSIDE nunca dispara**: Linha 583 → `isOutside = r1?.date ? new Date(tx.sale_date) < new Date(r1.date) : false`. Se o R1 não foi encontrado (r1 é null), `isOutside` é sempre `false`. Mas um lead que comprou contrato e nunca teve R1 agendada é exatamente o caso clássico de Outside.

3. **ANAMNESE falha silenciosamente**: Quando o phone fallback não encontra um contato com deals que tenham a tag ANAMNESE, o canal cai para LIVE. O problema é que o deal query busca deals por `contact_id`, mas se o contato encontrado por telefone não tem deals no CRM (ou tem deals sem tags), as tags nunca chegam.

### Correção

**`src/hooks/useCarrinhoAnalysisReport.ts`**:

**Bug 1 — LANÇAMENTO**: Adicionar `sale_origin` no `.select()` da query de contratos (linha 304). Na IIFE do `canalEntrada`, verificar `tx.sale_origin === 'launch'` além de `contrato mcf`.

**Bug 2 — OUTSIDE**: Usar a lógica de outside detection existente no projeto: consultar `hubla_transactions` para encontrar contratos do email que foram pagos ANTES da R1. Se não há R1, verificar se existe um contrato anterior à data do contrato A000 atual. Como alternativa mais simples e alinhada com `useOutsideDetection.ts`: se o lead tem contrato pago e NÃO tem R1 agendada, considerar rodar uma query separada de outside por email (comparando `sale_date` do contrato vs `scheduled_at` da R1 mais antiga). Na prática, a correção mínima: mudar a lógica de `isOutside` para também considerar o caso "comprou contrato mas R1 não existe no CRM" — buscar R1 por email (não só por contact_id) usando `meeting_slot_attendees` com join em `crm_contacts`.

**Bug 3 — ANAMNESE**: Após o phone fallback de deals, se ainda não há deal com tags, buscar tags diretamente dos deals do contato encontrado por telefone (query adicional `crm_deals.tags` por `contact_id` dos phone-matched contacts). Garantir que `mergeDealsIntoMap` realmente mescla tags de múltiplos deals do mesmo contato.

### Mudanças específicas

```
Linha 304: Adicionar sale_origin ao select
  .select('id, hubla_id, source, customer_name, customer_email, customer_phone, 
           product_name, product_category, sale_date, net_value, sale_status, 
           linked_attendee_id, installment_number, sale_origin')

Linha 583: Expandir isOutside
  // Se tem R1, comparar datas. Se NÃO tem R1 E não tem deal,
  // fazer query pontual de outside
  const isOutside = r1?.date 
    ? new Date(tx.sale_date) < new Date(r1.date) 
    : false;
  // NOVO: flag para outside sem R1 (será preenchido abaixo)

Linha 645-675: Atualizar canalEntrada
  // Adicionar: tx.sale_origin === 'launch'
  if (tx.sale_origin === 'launch' || prodLower.includes('contrato mcf')) 
    return 'LANÇAMENTO';
```

**Para OUTSIDE sem R1**: Adicionar uma query batch antes do loop de leads — buscar as R1s mais antigas por email (via `crm_contacts` → `meeting_slot_attendees`) para todos os emails que não têm R1 no `r1Map`. Comparar `sale_date` do contrato com essa R1. Se não há R1 nenhuma, o lead NÃO é outside (é um lead que ainda não agendou).

Porém, pela lista do usuário, Elaine/Otávio/Ariel SÃO outside — então eles provavelmente têm R1 em outro contato. A solução: expandir a busca de R1 por email (não apenas por contact_id), similar ao que já foi feito para deals no phone fallback.

### Plano final consolidado

1. Adicionar `sale_origin` na query de contratos
2. Na IIFE do `canalEntrada`: checar `tx.sale_origin === 'launch'` para LANÇAMENTO
3. Expandir R1 lookup: após o phone fallback, buscar R1 também por email em `meeting_slot_attendees` via `crm_contacts.email` para leads que ficaram sem R1
4. Com R1 expandido, `isOutside` passa a funcionar corretamente para mais leads
5. Garantir que tags de deals encontrados por phone fallback são mescladas corretamente

### Arquivos alterados
- `src/hooks/useCarrinhoAnalysisReport.ts`

