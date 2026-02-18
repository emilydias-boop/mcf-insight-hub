

# Deletar Transacao Fantasma do Olavo Vilela

## Problema

A transacao com id `09cacf20-57f8-47c0-ac3c-0a99f8b06290` foi inserida pelo webhook Make como uma venda A009 do Olavo Vilela, mas essa venda **nao existe na Hubla**. Conforme a captura de tela, ele so tem 3 faturas (A004, A000, Imersao).

### Dados da transacao fantasma:
- **ID:** `09cacf20-57f8-47c0-ac3c-0a99f8b06290`
- **Source:** `make`
- **Hubla ID:** `make_parceria_1770141755906_olavovilel`
- **Produto:** A009 - MCF INCORPORADOR COMPLETO + THE CLUB
- **Net value:** R$ 143.355 (claramente incorreto)
- **Gross override:** R$ 19.500
- **Product price:** R$ 1.000

## Acao

Deletar esta unica transacao do banco de dados:

```sql
DELETE FROM hubla_transactions 
WHERE id = '09cacf20-57f8-47c0-ac3c-0a99f8b06290';
```

## Impacto

- Remove R$ 143.355 de valor liquido fantasma dos relatorios
- Remove R$ 19.500 de faturamento bruto fantasma
- Nenhuma outra transacao do Olavo Vilela e afetada (as 3 reais permanecem)

