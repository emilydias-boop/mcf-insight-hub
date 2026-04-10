

# Fix: Valor Líquido inflado na Parcela 1

## Problema
A migration anterior corrigiu `valor_original` (Bruto) mas **não corrigiu `valor_liquido`** na parcela 1 da Nathália (e possivelmente outros). A P1 tem `valor_liquido = 8021.00` (valor total do contrato) enquanto deveria ser proporcional ao bruto.

Dados atuais da Nathália:
- P1: `valor_original = 85.00`, `valor_liquido = 8021.00` (ERRADO)
- P2-P5: `valor_original = 66.32`, `valor_liquido = 66.32` (OK)
- P6-P10: `valor_original = 66.32`, `valor_liquido = 0` (pendentes, OK)

O drawer soma todos os `valor_liquido` = 8021 + 66.32×4 = **R$ 8.286,28** (inflado).

## Solução — 2 partes

### 1. Migration SQL
Corrigir `valor_liquido` inflado usando a mesma lógica da migration anterior: pegar o `valor_liquido` de uma P2+ paga como referência e corrigir P1 quando estiver absurdamente maior.

```sql
-- Corrigir valor_liquido da P1 quando inflado
WITH ref AS (
  SELECT DISTINCT ON (subscription_id)
    subscription_id, valor_liquido as ref_val
  FROM billing_installments
  WHERE numero_parcela > 1 AND status = 'pago' AND valor_liquido > 0
  ORDER BY subscription_id, numero_parcela
)
UPDATE billing_installments bi
SET valor_liquido = r.ref_val
FROM ref r
WHERE bi.subscription_id = r.subscription_id
  AND bi.numero_parcela = 1
  AND bi.valor_liquido > r.ref_val * 3;
```

### 2. Fix no sync function
Na mesma seção onde já fixamos `valorLiquidoPerInstallment`, garantir que o `valor_liquido` da P1 no banco também use o valor por parcela (não o `net_value` total do contrato).

### Resultado
- Nathália P1: `valor_liquido` passa de 8021 para ~66.32
- Valor Líquido no drawer: ~350 (correto)
- Saldo Devedor: corrigido proporcionalmente

