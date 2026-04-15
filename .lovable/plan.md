

## Plano: Corrigir coluna "Dia Compra" no Carrinho R2

### Problema
O campo `contract_paid_at` nos attendees de R2 está NULL porque ele é preenchido apenas no attendee de **R1** (pelo webhook de contrato). Os registros de R2 são entradas separadas na tabela `meeting_slot_attendees` e não herdam esse valor.

### Solução
No hook `useR2CarrinhoData.ts`, na mesma etapa onde já buscamos os dados de R1 (linhas 257-287), também buscar o `contract_paid_at` do attendee de R1 vinculado ao mesmo `deal_id`, e popular o campo nos attendees de R2.

### Alterações

**`src/hooks/useR2CarrinhoData.ts`**
- Na query de R1 (linha 260-268), adicionar `contract_paid_at` ao select dos `meeting_slot_attendees`
- No mapeamento do `r1Map`, incluir `contract_paid_at` junto com `date` e `closer_name`
- No loop de merge (linhas 281-286), popular `att.contract_paid_at` a partir do R1 quando o valor local for null

### Detalhes técnicos

```ts
// Linha 265: adicionar contract_paid_at ao select
meeting_slot_attendees!inner(deal_id, contract_paid_at)

// Linha 270: incluir contract_paid_at no map
const r1Map = new Map<string, { date: string; closer_name: string | null; contract_paid_at: string | null }>();

// Linha 276: salvar no map
r1Map.set(rAtt.deal_id, { 
  date: r1.scheduled_at, 
  closer_name: r1Closer?.name || null,
  contract_paid_at: rAtt.contract_paid_at || null 
});

// Linha 283: popular no attendee R2
att.contract_paid_at = att.contract_paid_at || r1Map.get(att.deal_id)!.contract_paid_at;
```

Nenhum arquivo adicional precisa ser alterado — a coluna na tabela já está implementada corretamente.

