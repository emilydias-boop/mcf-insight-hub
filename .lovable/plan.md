

## Problema

Ao visualizar o fechamento de **fevereiro 2026**, a coluna "Nível" mostra o nível **atual** do colaborador (março), não o nível que estava vigente em fevereiro. Isso acontece porque:

1. A tabela `sdr_month_payout` não armazena o nível vigente na época
2. O código em `Index.tsx` linha 479 lê `employee?.cargo_catalogo?.nivel` — que é o nível **atual** do RH
3. O `sdr_comp_plan` tem versionamento por vigência mas também não armazena o campo `nivel`

## Solução

Congelar o nível e o cargo no momento do cálculo do payout, similar ao que já é feito com `departamento_vigente`.

### 1. Adicionar colunas na tabela `sdr_month_payout`
```sql
ALTER TABLE sdr_month_payout 
  ADD COLUMN IF NOT EXISTS nivel_vigente integer,
  ADD COLUMN IF NOT EXISTS cargo_vigente text;
```

### 2. Edge Function `recalculate-sdr-payout`
Ao criar/atualizar o payout, gravar `nivel_vigente` e `cargo_vigente` com os valores do momento do cálculo (vindos do `cargo_catalogo` ou `sdr.nivel`).

### 3. Frontend `Index.tsx`
Alterar a lógica de exibição do Nível (linha 479) para priorizar o valor congelado:
```
nivel = payout.nivel_vigente || employee?.cargo_catalogo?.nivel || sdr.nivel || 1
```

Mesma lógica no export CSV (linha 235).

### 4. Regenerar tipos Supabase
Atualizar `types.ts` para incluir os novos campos.

## Impacto
- Fechamentos **futuros** serão congelados automaticamente ao recalcular
- Fechamentos **passados** (como fev/2026) precisarão de um "Recalcular Todos" para preencher os campos retroativamente
- A exibição passará a mostrar o nível correto da época em vez do atual

