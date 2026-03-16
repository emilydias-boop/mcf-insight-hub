

## Ajustes na aba Pagamentos: filtro por mês, KPIs dinâmicos e ações de status

### Problemas identificados

1. **Não acompanha o mês selecionado**: O `ConsorcioPagamentosTab` não recebe o `monthOffset` do Index.tsx. Carrega todas as 51k parcelas sem filtro de mês.
2. **KPIs não filtram por mês**: Os KPIs são calculados sobre TODOS os dados, não sobre o mês selecionado.
3. **Sem ação de marcar como pago**: A tabela só tem botão de "ver detalhes" (Eye), sem possibilidade de alterar status.

### Solução

**1. Passar o mês selecionado para a aba Pagamentos**

- **`Index.tsx`**: Passar `monthOffset` (ou `startDate`/`endDate`) como prop para `<ConsorcioPagamentosTab />`
- **`ConsorcioPagamentosTab.tsx`**: Receber `selectedMonth: { start: Date; end: Date }` e passá-lo ao hook

**2. Hook `useConsorcioPagamentos.ts` -- filtrar por mês**

- Receber parâmetro `selectedMonth: { start: string; end: string }` 
- Na query Supabase, adicionar `.gte('data_vencimento', start).lte('data_vencimento', end)` para só buscar parcelas do mês
- KPIs e alertas passam a ser calculados automaticamente sobre os dados do mês filtrado
- Isso também resolve performance (busca ~200-500 parcelas em vez de 51k)

**3. Ações na tabela -- marcar como pago e editar status**

- **`PagamentosTable.tsx`**: Adicionar dropdown de ações por linha com:
  - "Marcar como Paga" (chama `usePayInstallment` existente de `useConsorcio.ts` com `dataPagamento = hoje`)
  - "Abrir Cota" (navega para o drawer da cota)
  - "Ver Detalhes" (mantém o drawer atual)
- Reutilizar o mutation `usePayInstallment` já existente que faz `UPDATE consortium_installments SET status='pago', data_pagamento=...`
- Após mutação, invalidar também `queryKey: ['consorcio-pagamentos-all']` para atualizar a lista

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/bu-consorcio/Index.tsx` -- passar `selectedMonth` ao `ConsorcioPagamentosTab` |
| Editar | `src/components/consorcio/pagamentos/ConsorcioPagamentosTab.tsx` -- receber prop de mês, passar ao hook |
| Editar | `src/hooks/useConsorcioPagamentos.ts` -- filtrar query por mês, KPIs sobre dados do mês |
| Editar | `src/components/consorcio/pagamentos/PagamentosTable.tsx` -- adicionar dropdown de ações (pagar, abrir cota) |
| Editar | `src/hooks/useConsorcio.ts` -- invalidar cache de pagamentos no `usePayInstallment` |

