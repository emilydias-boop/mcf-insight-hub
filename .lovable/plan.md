
# Plano: Corrigir Automação de Contrato Pago e Sincronizar Dados

## Problema Identificado

A função `autoMarkContractPaid` no webhook `hubla-webhook-handler` **não está sendo chamada** para a maioria dos pagamentos de contrato porque:

1. Os logs mostram "Processando **0 items** da invoice..." para pagamentos A000
2. Quando `items.length === 0`, o código entra no bloco das linhas 816-889
3. Esse bloco **não chama** `autoMarkContractPaid`
4. A chamada está apenas no loop de items (linha 994), que só executa quando `items.length > 0`

### Impacto Atual

| Métrica | Esperado | Exibido |
|---------|----------|---------|
| Vendas A000 (27/01) | 7 | 7 ✅ |
| Contratos no Relatório | 7 | 4 ❌ |
| Contratos Julio | 4 | 1 ❌ |

### Leads do Julio que pagaram mas não foram vinculados:
- **CAIS ENGENHARIA** (lawrence.leite@gmail.com) - status: `invited`
- **Lorena das Graça** - status: `invited`
- **Ana luzia maranini** - status: `invited`

## Solução Proposta

### 1. Adicionar chamada de `autoMarkContractPaid` no bloco `items.length === 0`

Modificar `supabase/functions/hubla-webhook-handler/index.ts` para incluir a lógica de detecção de contrato também quando não há items:

```typescript
// Após linha 888 (fim do bloco if items.length === 0):
// Adicionar a mesma lógica de detecção de contrato pago

// Detectar se é um pagamento de contrato
const itemPriceForContractCheck = grossValue;
const isContratoPago = (
  productCategory === 'contrato' || 
  (productCategory === 'incorporador' && itemPriceForContractCheck >= 490 && itemPriceForContractCheck <= 510) ||
  (productName.toUpperCase().includes('A000') && productName.toUpperCase().includes('CONTRATO'))
);

// Se for contrato e primeira parcela, auto-marcar reunião R1
if (isContratoPago && installment === 1) {
  console.log(`🎯 [CONTRATO HUBLA] Pagamento detectado (sem items), buscando reunião R1...`);
  await autoMarkContractPaid(supabase, {
    customerEmail: transactionData.customer_email,
    customerPhone: transactionData.customer_phone,
    customerName: transactionData.customer_name,
    saleDate: saleDate
  });
}
```

### 2. Correção Retroativa

Executar uma migração SQL para corrigir os attendees que já pagaram contrato mas não foram marcados:

```sql
-- Identificar attendees com pagamento de contrato mas status ainda 'invited' ou 'completed'
WITH paid_contracts AS (
  SELECT DISTINCT 
    ht.customer_email,
    ht.customer_phone,
    ht.sale_date
  FROM hubla_transactions ht
  WHERE ht.product_name ILIKE '%A000%Contrato%'
    AND ht.sale_status = 'completed'
    AND ht.sale_date >= '2026-01-27T00:00:00'
),
attendees_to_update AS (
  SELECT msa.id as attendee_id, ms.scheduled_at
  FROM meeting_slot_attendees msa
  JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
  JOIN crm_deals d ON d.id = msa.deal_id
  JOIN crm_contacts c ON c.id = d.contact_id
  WHERE ms.meeting_type = 'r1'
    AND msa.status IN ('invited', 'scheduled', 'completed')
    AND EXISTS (
      SELECT 1 FROM paid_contracts pc
      WHERE LOWER(c.email) = LOWER(pc.customer_email)
    )
)
UPDATE meeting_slot_attendees 
SET status = 'contract_paid', 
    contract_paid_at = (SELECT MIN(ms.scheduled_at) FROM meeting_slots ms WHERE ms.id = meeting_slot_attendees.meeting_slot_id)
WHERE id IN (SELECT attendee_id FROM attendees_to_update);
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/hubla-webhook-handler/index.ts` | Adicionar chamada `autoMarkContractPaid` no bloco sem items (após linha 888) |

## Resultado Esperado

Após a correção:

| Antes | Depois |
|-------|--------|
| Automação falha quando `items.length === 0` | Automação funciona em ambos os cenários |
| Julio mostra 1 contrato pago | Julio mostra 4 contratos pagos |
| Relatório Contratos: 4 | Relatório Contratos: 7+ |
| Números inconsistentes entre telas | Números sincronizados |

## Testes Necessários

1. Aguardar próximo pagamento de contrato A000
2. Verificar nos logs se aparece "[CONTRATO HUBLA] Pagamento detectado (sem items)"
3. Verificar se attendee é atualizado para `contract_paid`
4. Verificar se notificação é enviada ao closer
