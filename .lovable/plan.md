

## Adicionar Closer de R1 no relatorio copiado e na tabela de Aprovados

### Problema

O relatorio copiado na aba Aprovados mostra apenas o closer de R2. A equipe precisa ver tambem o closer de R1 para saber de qual closer veio cada lead.

### Alteracoes

**1. `src/hooks/useR2CarrinhoData.ts`**

- Adicionar `r1_closer_name: string | null` ao interface `R2CarrinhoAttendee` (linha 27)
- Alterar a query de R1 meetings (linha 117-124) para incluir o closer: `closer:closers!meeting_slots_closer_id_fkey(id, name)`
- Mudar `r1Map` de `Map<string, string>` para `Map<string, { date: string; closer_name: string | null }>` para guardar tanto a data quanto o nome do closer de R1
- Preencher `r1_closer_name` no objeto final (linha ~175) usando `r1Map.get(att.deal_id)?.closer_name`

**2. `src/components/crm/R2AprovadosList.tsx`**

- No `generateReport()` (linha 166): mudar o formato para incluir closer R1:
  ```
  ${name}\t${phone}\t${r1Closer}\t${closer}${suffix}
  ```
  Onde `r1Closer = att.r1_closer_name || '-'` e `closer` e o closer R2

- Na tabela (linha 316): adicionar coluna "Closer R1" antes da coluna "Closer" (que passa a representar Closer R2)

- No `handleExportExcel()` (linha 181): adicionar "Closer R1" nos headers e nos rows

### Formato do relatorio copiado

```text
*Carrinho 27/02*

*SELECIONADOS 47*

LISTA DOS QUE NÃO COMPRARAM AINDA: 47

Alisson Cardoso Frota	85997168861	Ana Silva	Jessica Martins - VAI COMPRAR 🔥
```

Ordem: Nome - Telefone - Closer R1 - Closer R2 - Status

