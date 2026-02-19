

# Deletar Transacoes Fantasma A001 do Juliano Cesar Franca

## Problema

Na Hubla, o Juliano Cesar Franca (jfmoveis@icloud.com) tem apenas 2 faturas pagas:
- A009 - MCF INCORPORADOR COMPLETO + THE CLUB (R$ 12.796,90)
- A000 - Contrato MCF (R$ 593,88)

Porem, no sistema existem 3 transacoes adicionais fantasma referentes a um A001 que nunca existiu:

1. **A001 refunded** (id: `d4cce494-5edc-4470-bbb7-83ca2bf6e510`) - net R$ 5.823,14
2. **A001 newsale** (id: `9cffa1ba-59b1-465d-b93c-961bf48017f8`) - net R$ 0
3. **Parceria Make** (id: `b7a6a98a-a6dc-4d9e-8994-01817d200b84`) - duplicata Make do A001 fantasma, net R$ 5.823,14

## Acao

Deletar as 3 transacoes fantasma:

```sql
DELETE FROM hubla_transactions 
WHERE id IN (
  'd4cce494-5edc-4470-bbb7-83ca2bf6e510',
  '9cffa1ba-59b1-465d-b93c-961bf48017f8',
  'b7a6a98a-a6dc-4d9e-8994-01817d200b84'
);
```

## Impacto

- Remove R$ 5.823,14 de liquido fantasma (A001 refunded) e R$ 5.823,14 da duplicata Make
- Remove R$ 14.500 de bruto fantasma (A001)
- As 2 transacoes reais permanecem intactas:
  - A009: net R$ 8.902,94, bruto R$ 19.500
  - A000 Contrato: net R$ 388,10, bruto R$ 497
- Tambem permanece a transacao Make parceria do A009 (`b40a8173-...`) que ja e tratada pela deduplicacao automatica

