## Problema

O painel `/crm/reunioes-equipe` (BU Incorporador, 02/07/2026) mostra **17 contratos** quando na verdade são **18**. O contrato faltante é do **Thompson da Silva Nunes** (closer Jessica Bellini):

- R1 agendada para 02/07 às 10:15 BRT
- Contrato pago às 09:40 BRT (35 min antes da reunião começar)
- `status = contract_paid`, `contract_paid_at` preenchido, tudo vinculado corretamente

## Causa raiz

Em `src/hooks/useR1CloserMetrics.ts` (linhas 278-289) existe esta regra:

```ts
const isOutside = new Date(contract_paid_at) < new Date(scheduled_at);
if (isOutside) return; // não conta como contrato pago
```

Ela remove do KPI qualquer contrato pago **antes** do horário agendado da R1. E a Part B (que reclassifica como Outside) tem uma trava que **só** conta como Outside quando o email **não** tem R1 vinculada — o Thompson tem R1, então também é excluído lá. Resultado: some de tudo.

Essa regra está semanticamente errada: "Outside" no restante do sistema significa **venda sem R1 correspondente** (comprou direto pela Hubla), não "pagou pouco antes da hora da reunião".

## Correção

**Arquivo:** `src/hooks/useR1CloserMetrics.ts`

Remover o bloco `isOutside` das linhas 278-289 do processamento de contratos COM `contract_paid_at`. Passa a valer a regra simples: se o attendee tem `contract_paid_at` no período, `is_partner = false` e slot dentro do range de datas → conta como Contrato Pago do closer do slot.

A Part B (linhas 305-470) continua intacta, detectando Outsides verdadeiros (vendas Hubla sem R1).

Também aplicar a mesma correção em `src/hooks/useCloserContractsList.ts` linha 87 — mesma lógica errada, faz o lead sumir da lista drill-down do closer.

## Impacto esperado

- Painel de 02/07 passa a mostrar **18 contratos** (Jessica Bellini: 0 → 1, total: 17 → 18)
- Nenhuma outra métrica é afetada (Outside continua zero para 02/07 pela mesma Part B)
  &nbsp;

## Nenhuma alteração de banco necessária

Só duas edições de front-end. Sem migration, sem RPC, sem edge function.