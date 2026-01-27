

# Plano: Reprocessar Contratos e Garantir Deploy

## Problema Identificado

O código corrigido com a lógica de transferência de ownership ainda **não foi deployado** para a Edge Function em produção. Os pagamentos de Juliano (26/01 23:04) e Claudia (27/01 00:33) foram processados pela versão **antiga** do código, que:
1. Não detectava corretamente A000-Contrato como contrato pago
2. Não transferia ownership do deal para o closer

## Solução em 3 Etapas

### Etapa 1: Criar Edge Function de Reprocessamento

Criar uma nova Edge Function `reprocess-contract-payments` que:
- Busca transações de contrato recentes (últimos 7 dias) na `hubla_transactions`
- Para cada transação, encontra o attendee R1 correspondente
- Marca como `contract_paid` se ainda não estiver
- Transfere ownership do deal para o closer
- Atualiza `original_sdr_email` e `r1_closer_email`
- Move para estágio "Contrato Pago"

### Etapa 2: Corrigir Detecção de Contrato no Webhook

Atualmente o mapeamento de `A000 - Contrato` retorna `incorporador`. Precisamos garantir que a lógica de detecção de contrato funcione corretamente:

O código já tem a verificação:
```typescript
const isContratoPago = (
  productCategory === 'contrato' || 
  (productCategory === 'incorporador' && grossValue >= 490 && grossValue <= 510) ||
  (productName.toUpperCase().includes('A000') && productName.toUpperCase().includes('CONTRATO'))
);
```

Mas o Juliano pagou R$ 593.88 (parcelado com juros), que está fora do range 490-510. Precisamos:
- Ampliar o range para detectar contratos com juros (490-650)
- OU usar apenas o nome do produto para detecção

### Etapa 3: Deploy da Edge Function

Garantir que a Edge Function `hubla-webhook-handler` seja redeployada com todas as correções.

---

## Detalhes Técnicos

### Nova Edge Function: `reprocess-contract-payments`

**Arquivo:** `supabase/functions/reprocess-contract-payments/index.ts`

```typescript
// Buscar transações de contrato dos últimos 7 dias
const { data: transactions } = await supabase
  .from('hubla_transactions')
  .select('*')
  .gte('sale_date', sevenDaysAgo.toISOString())
  .or('product_category.eq.contrato,product_name.ilike.%contrato%,and(product_category.eq.incorporador,product_price.gte.490,product_price.lte.650)')
  .eq('installment_number', 1)
  .order('sale_date', { ascending: false });

// Para cada transação, reprocessar
for (const tx of transactions) {
  // 1. Buscar attendee R1 por email ou telefone
  // 2. Verificar se já está marcado como contract_paid
  // 3. Se não, marcar e transferir ownership
  // 4. Registrar log de reprocessamento
}
```

### Correção no Webhook Principal

**Arquivo:** `supabase/functions/hubla-webhook-handler/index.ts`

Linha ~1079-1083 - Ampliar range de detecção:

```typescript
const isContratoPago = (
  productCategory === 'contrato' || 
  // CORREÇÃO: Ampliar range para incluir contratos com juros de parcelamento
  (productCategory === 'incorporador' && itemPriceForContractCheck >= 490 && itemPriceForContractCheck <= 650) ||
  (productName.toUpperCase().includes('A000') && productName.toUpperCase().includes('CONTRATO'))
);
```

---

## Fluxo de Reprocessamento

```text
Edge Function reprocess-contract-payments
                    |
                    v
Buscar transações de contrato (últimos 7 dias)
                    |
                    v
Para cada transação:
  - Buscar attendee R1 (email/telefone)
  - Se attendee.status != 'contract_paid':
      - Marcar attendee como contract_paid
      - Marcar meeting_slot como completed
      - Buscar closer_id do meeting
      - Transferir deal.owner_id para closer
      - Preservar original_sdr_email
      - Mover para estágio "Contrato Pago"
                    |
                    v
Retornar resumo: N processados, M transferidos, X erros
```

---

## Casos que Serão Corrigidos

| Cliente | Situação Atual | Após Reprocessamento |
|---------|----------------|----------------------|
| Juliano Locatelli | owner: juliana.rodrigues@ | owner: julio.caetano@ |
| Claudia Ciarlini | owner: caroline.souza@ | owner: julio.caetano@ |

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/reprocess-contract-payments/index.ts` | CRIAR - Nova função de reprocessamento |
| `supabase/functions/hubla-webhook-handler/index.ts` | MODIFICAR - Ampliar range de detecção (490-650) |
| `supabase/config.toml` | MODIFICAR - Registrar nova função |

---

## Execução

Após aprovar este plano:
1. Criarei a Edge Function `reprocess-contract-payments`
2. Ajustarei o range de detecção no webhook principal
3. O deploy será automático
4. Você poderá chamar a função de reprocessamento para corrigir Juliano e Claudia

