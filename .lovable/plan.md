
# Diagnóstico: Inflação de R$ 73.000 no Bruto Total

## Problema Identificado

A mudança que fizemos (dar prioridade ao `gross_override`) está funcionando corretamente, **mas existem 4 transações com overrides órfãos** que estão duplicando o bruto.

### O que aconteceu:

1. Transações do **make** foram criadas com `gross_override` para registrar vendas (ex: Henrique com R$ 19.500)
2. Depois, foram criadas transações **manuais** ou **Hubla** para o mesmo cliente/produto
3. O sistema marcou as novas transações como "FIRST" (primeira do grupo)
4. As transações make com override **continuaram contando** porque o override tem prioridade

### Transações inflando o bruto:

| Cliente | Email | Produto | Override | Fonte |
|---------|-------|---------|----------|-------|
| André Luiz Gonçalves Raineri | andre.raineri@hotmail.com | A001 | R$ 14.500 | make |
| Arão Young Kim | arao_young@hotmail.com | A009 | R$ 19.500 | make |
| Henrique oliveira amorim | hav.arqeng@gmail.com | A009 | R$ 19.500 | make |
| Izaquiel Leonardo Antunes | izaquiel.antunes@gmail.com | A009 | R$ 19.500 | make |

**Total de inflação: R$ 73.000**

---

## Solução

Zerar o `gross_override` dessas 4 transações, pois o valor bruto já está sendo contabilizado pela transação "primeira" (manual ou Hubla).

### SQL para correção:

```sql
-- Zerar overrides das transações duplicadas
UPDATE hubla_transactions
SET gross_override = 0
WHERE id IN (
  '10695e63-471d-4181-9d52-5e300c97433f',  -- André Raineri
  '1569c31f-8271-416d-a9df-de8a79d315df',  -- Arão Young
  'c89e7e6a-1c62-495b-93ac-37a2018954c1',  -- Henrique
  'd3e063ab-1725-4fe3-95d7-b56559371d2f'   -- Izaquiel
);
```

---

## Prevenção Futura

A lógica atual está correta para o caso do **Rodrigo Jesus** (lead de lançamento sem transação anterior válida). O problema não é o código, são dados históricos com overrides que precisam ser limpos.

**Recomendação**: Após aplicar a correção, o Bruto Total deve reduzir em R$ 73.000.

---

## Resumo

- **Não é bug de código** - a prioridade do override está correta
- **É problema de dados** - overrides criados antes das transações "oficiais"
- **Correção**: Executar UPDATE para zerar os 4 overrides duplicados
- **Resultado esperado**: Bruto Total volta ao valor correto (R$ 1.782.335 aproximadamente)
