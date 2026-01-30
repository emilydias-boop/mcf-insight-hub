
# Plano: Corrigir Deduplicação e Exclusão de Transações Make

## Problemas Identificados

Após análise detalhada das 4 situações reportadas:

### 1. André Luiz Gonçalves Raineri
- **Esperado**: A001 com Bruto R$ 14.500 (comprou dia 23 primeira vez)
- **Atual**: Bruto só R$ 497 (contrato), A001 tratado como recorrência
- **Causa**: Transação **make** está sendo selecionada como "primeira" ao invés da Hubla

### 2. Arão Young Kim
- **Esperado**: A009 com Bruto R$ 19.500
- **Atual**: Bruto R$ 0 (zerado)
- **Causa**: Zeramos o `gross_override` da transação make, mas era ela que estava marcada como "primeira" pela deduplicação

### 3. Henrique Oliveira Amorim
- **Status**: Correto (R$ 19.500 na transação manual "Novo")
- **Problema visual**: Transações make ainda aparecem na listagem

### 4. Izaquiel Leonardo Antunes
- **Esperado**: A009 com Bruto R$ 19.500
- **Atual**: Bruto R$ 0 (zerado)
- **Causa**: Mesma situação do Arão - transação make marcada como primeira e zerada

---

## Causa Raiz

A função `get_first_transaction_ids()` está incluindo `source = 'make'` na deduplicação, mas:

1. **Make e Hubla têm o mesmo `sale_date`** para a mesma venda (sincronia via webhook)
2. **O desempate é indeterminado** quando datas são iguais
3. **Zeramos os overrides das transações make** mas elas ainda estão sendo marcadas como "primeira"

---

## Solução em 2 Partes

### Parte 1: Corrigir a Função de Deduplicação

Modificar `get_first_transaction_ids()` para:
1. **Priorizar source 'hubla' e 'manual' sobre 'make'** quando as datas são iguais
2. Adicionar `ORDER BY sale_date ASC, CASE source WHEN 'hubla' THEN 1 WHEN 'manual' THEN 2 ELSE 3 END`

```sql
ORDER BY ht.sale_date ASC, 
  CASE ht.source 
    WHEN 'hubla' THEN 1 
    WHEN 'manual' THEN 2 
    ELSE 3 
  END ASC
```

### Parte 2: Restaurar os Overrides Zerados

Como os overrides foram zerados incorretamente (a transação make não deveria ser a primeira), devemos:

1. **Arão Young Kim**: Restaurar `gross_override = 19500` na transação make OU deixar zerado se a Hubla passar a ser a primeira
2. **Izaquiel**: Mesma lógica

**Após a correção da função**, a transação Hubla será marcada como "primeira" e receberá o bruto automaticamente via preço de referência.

---

## Passos de Implementação

1. **Migração SQL**: Atualizar `get_first_transaction_ids()` com desempate por source
2. **Verificação**: Confirmar que as transações Hubla passam a ser "primeira"
3. **Sem necessidade de restaurar overrides**: O bruto será calculado pelo preço de referência do produto

---

## Resultado Esperado

| Cliente | Bruto Atual | Bruto Esperado |
|---------|-------------|----------------|
| André Raineri | R$ 497 | R$ 14.997 (497 + 14.500) |
| Arão Young Kim | R$ 497 | R$ 19.997 (497 + 19.500) |
| Izaquiel | R$ 544 | R$ 20.044 (497 + 47 + 19.500) |
| Henrique | R$ 20.101 | R$ 20.101 (correto) |

As transações make continuarão aparecendo na listagem como "Recorrente" (bruto zero), o que é correto pois são registros de tracking do Make.
