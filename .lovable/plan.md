

## Deduplicar transações duplicadas no Histórico de Compras

### Problema
O lead Odegleyson comprou o contrato pela Hubla, mas no drawer aparece 3 vezes: 1x da fonte `make` ("Contrato") e 2x da fonte `hubla` ("A000 - Contrato"). Isso acontece porque o `useLeadPurchaseHistory` busca de todas as fontes (`hubla`, `kiwify`, `manual`, `make`) sem nenhuma deduplicação.

### Solução
Aplicar deduplicação client-side no hook `useLeadPurchaseHistory`, seguindo a lógica já documentada no sistema:
- Quando existe uma transação de fonte prioritária (`hubla`, `kiwify`) para o mesmo e-mail e mesma data de venda (`sale_date` no mesmo dia), remover a transação duplicada da fonte `make` com nome similar.
- Adicionalmente, deduplicar transações da mesma fonte com mesmo `product_name` e mesma `sale_date` (mantendo apenas uma).

### Arquivo a alterar
**`src/hooks/useLeadPurchaseHistory.ts`**

1. Após receber os dados, agrupar por `sale_date` (dia) + `product_name` normalizado
2. Para cada grupo: se existir transação de fonte prioritária (`hubla`/`kiwify`), remover as de fonte `make` com nome similar (ex: "Contrato" vs "A000 - Contrato")
3. Deduplicar registros idênticos (mesma fonte, mesmo produto, mesmo dia) mantendo apenas um

### Lógica de deduplicação
```text
Antes:  Contrato (make, 25/03) + A000-Contrato (hubla, 25/03) + A000-Contrato (hubla, 25/03)
Após:   A000-Contrato (hubla, 25/03)  ← 1 único registro
```

Critério de similaridade: normalizar nome removendo prefixos como "A000 - " e comparar se contém a mesma palavra-chave (ex: "contrato").

