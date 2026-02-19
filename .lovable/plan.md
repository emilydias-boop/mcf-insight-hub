
# Corrigir Contagem Duplicada de Liquido em Grupos com Order Bumps

## Problema Identificado

Quando a Hubla envia uma compra com multiplos itens (offers), ela cria:
- **Main** (hubla_id base): Valor total do carrinho (net = soma de todos os offers)
- **Offer-1, Offer-2, etc.**: Itens individuais com seus net values proprios

O sistema esta somando o net do main + net dos offers, causando **duplicacao do valor liquido**.

### Exemplo concreto (Breno Salgado):
- Main A009: net R$ 16.501,52 (= carrinho total)
- Offer-1 A009: net R$ 15.325,03
- Offer-2 Clube: net R$ 1.176,49
- **Soma dos offers = R$ 16.501,52** (igual ao main!)
- **Sistema mostra:** R$ 31.826,55 (main + offer-1, pois offer-2 esta filtrado por categoria)

## Solucao

### 1. Alterar `groupTransactionsByPurchase` em `TransactionGroupRow.tsx`

Quando um grupo tem offers (order bumps), **excluir o net_value do main** do calculo de `totalNet`, pois o main ja e a soma dos offers.

Logica:
- Se o grupo tem orderBumps, o `totalNet` deve somar apenas os nets dos offers (que sao o detalhamento)
- Se o grupo nao tem orderBumps, usar o net do main normalmente

Na pratica, a mudanca e: ao calcular `totalNet`, se a transacao e o main E existem offers no grupo, nao somar o net do main.

### 2. Ajustar calculo do Bruto no grupo

Mesma logica para o bruto: o main tem `product_price = 20.997` (carrinho total), mas o bruto deveria ser baseado apenas no produto principal (A009 = R$ 19.500). Como os offers ja tem os precos individuais corretos, usar os offers para o calculo de bruto quando existirem.

### 3. Impacto no Liquido Total da pagina

O card "Liquido Total" usa a soma dos `totalNet` de todos os grupos, entao sera automaticamente corrigido.

## Detalhes Tecnicos

### Arquivo: `src/components/incorporador/TransactionGroupRow.tsx`

Na funcao `groupTransactionsByPurchase` (linhas 333-387), alterar a logica de soma:

```text
ANTES:
  group.totalNet += tx.net_value || 0;  // Soma TUDO

DEPOIS:
  // Ao final do agrupamento, recalcular totalNet:
  // Se grupo tem offers, somar apenas os nets dos offers
  // Se nao tem offers, usar o net do main
```

Implementacao em duas fases:
1. Primeira passagem: agrupar normalmente (como hoje)
2. Segunda passagem: para cada grupo com orderBumps, recalcular `totalNet` = soma dos nets dos offers (excluindo o main)

Para o bruto, mesma abordagem: recalcular `totalGross` usando apenas os offers quando existirem, para evitar o preco inflado do carrinho total.

## Resultado Esperado

- Breno Salgado: Liquido do grupo A009 passara de R$ 31.826,55 para R$ 16.501,52 (ou soma dos offers visiveis)
- Bruto Total corrigido proporcionalmente
- Todos os outros clientes com order bumps tambem serao corrigidos automaticamente
