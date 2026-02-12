

# Corrigir Duplicacao de Transacoes Make + Hubla

## Problema

Quando uma venda de parceria ocorre, **dois webhooks** disparam simultaneamente:
1. **Hubla** cria: `A009 - MCF INCORPORADOR COMPLETO + THE CLUB` com `net_value = 16.680,45`
2. **Make** cria: `Parceria` com `net_value = 16.680,45` (copiado do registro Hubla pela logica de correcao de valor)

O resultado: o Liquido Total aparece **dobrado** (R$ 1.128.876,83 vs o valor real).

## Causa Raiz

A RPC `get_all_hubla_transactions` retorna ambos os registros sem deduplicacao. O webhook `webhook-make-parceria` nao verifica se ja existe um registro Hubla para o mesmo cliente/data/valor antes de inserir.

## Solucao (duas camadas)

### 1. Deduplicacao na RPC (efeito imediato)

Atualizar a funcao `get_all_hubla_transactions` para excluir transacoes `source = 'make'` quando ja existe uma transacao `source = 'hubla'` para o mesmo `customer_email`, mesma data (mesmo dia) e valor bruto similar (margem de 5%).

Logica SQL:

```text
AND NOT EXISTS (
  SELECT 1 FROM hubla_transactions h2
  WHERE h2.source = 'hubla'
    AND h2.customer_email = ht.customer_email
    AND h2.sale_date::date = ht.sale_date::date
    AND h2.product_price BETWEEN ht.product_price * 0.95 AND ht.product_price * 1.05
    AND h2.net_value > 0
)
-- Aplicado apenas quando ht.source = 'make'
```

### 2. Deduplicacao no webhook (prevencao futura)

Atualizar `webhook-make-parceria` para verificar se ja existe um registro Hubla antes de inserir. Se encontrar, marcar o registro Make com `count_in_dashboard = false` em vez de nao inserir (para manter rastreabilidade).

### 3. Correcao dos dados existentes

Executar um UPDATE para marcar as transacoes Make duplicadas existentes com `count_in_dashboard = false`:

```text
UPDATE hubla_transactions make_tx
SET count_in_dashboard = false
WHERE make_tx.source = 'make'
  AND make_tx.product_category = 'parceria'
  AND EXISTS (
    SELECT 1 FROM hubla_transactions hubla_tx
    WHERE hubla_tx.source = 'hubla'
      AND hubla_tx.customer_email = make_tx.customer_email
      AND hubla_tx.sale_date::date = make_tx.sale_date::date
      AND hubla_tx.product_price BETWEEN make_tx.product_price * 0.95
                                     AND make_tx.product_price * 1.05
      AND hubla_tx.net_value > 0
  );
```

## Detalhes Tecnicos

### Arquivos a modificar

- **Migracao SQL**: Atualizar RPC `get_all_hubla_transactions` com clausula NOT EXISTS para excluir duplicatas Make
- **Migracao SQL**: UPDATE para corrigir dados existentes (marcar duplicatas como `count_in_dashboard = false`)
- **`supabase/functions/webhook-make-parceria/index.ts`**: Adicionar verificacao pre-insercao -- se Hubla ja processou o mesmo email+data+valor, marcar `count_in_dashboard = false`

### Ordem de implementacao

1. Migracao SQL com UPDATE corretivo + RPC atualizada (resolve o problema imediatamente para dados existentes e futuros)
2. Atualizar webhook Make para prevenir duplicatas futuras na fonte

