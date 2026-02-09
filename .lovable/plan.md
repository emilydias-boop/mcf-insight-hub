

# Permitir editar data do primeiro pagamento e recalcular todas as parcelas

## O que muda para o usuario

### No Formulario de Cadastro (Nova Carta)
- Substituir o campo "Dia de Vencimento" (input numerico) por um **datepicker** chamado "Data do Primeiro Pagamento"
- O usuario seleciona a data exata da primeira parcela (ex: 15/02/2026 — mes atual)
- O `dia_vencimento` e extraido automaticamente dessa data (dia 15)
- As parcelas seguintes sao calculadas a partir dessa data, nao da data de contratacao

### Na Tabela de Parcelas (Drawer da Carta)
- Ao editar a **parcela 1** e alterar a data de vencimento, o sistema pergunta: "Deseja recalcular as datas das demais parcelas a partir desta data?"
- Se sim: recalcula todas as parcelas seguintes mantendo o mesmo dia do mes, ajustando para dia util
- Se nao: altera apenas a parcela 1

## Alteracoes tecnicas

### 1. Schema do formulario (`ConsorcioCardForm.tsx`)
- Adicionar campo `data_primeiro_pagamento: z.date()` no schema
- Remover/substituir campo numerico `dia_vencimento` por datepicker de "Data do Primeiro Pagamento"
- Derivar `dia_vencimento` automaticamente: `data_primeiro_pagamento.getDate()`
- Ao submeter, enviar `data_primeiro_pagamento` formatada como string ISO

### 2. Tipo de input (`types/consorcio.ts`)
- Adicionar `data_primeiro_pagamento?: string` ao `CreateConsorcioCardInput`

### 3. Geracao de parcelas (`useConsorcio.ts` — `useCreateConsorcioCard`)
- Se `data_primeiro_pagamento` existir, usar essa data como base para parcela 1 (offset 0 meses em vez de 1)
- Parcela 2 = data_primeiro_pagamento + 1 mes, parcela 3 = + 2 meses, etc.
- Manter logica de ajuste para dia util

### 4. Recalcular datas ao editar parcela 1 (`EditInstallmentDialog.tsx` + `ConsorcioCardDrawer.tsx`)
- No `EditInstallmentDialog`: detectar quando `numero_parcela === 1`
- Mostrar checkbox/switch: "Recalcular datas das demais parcelas"
- Quando ativado e salvo: atualizar `data_vencimento` de todas as parcelas subsequentes baseado na nova data da parcela 1
- O `handleSaveInstallment` no drawer faz o batch update das parcelas restantes

### 5. Funcao auxiliar (`businessDays.ts`)
- Adicionar funcao `recalcularDatasAPartirDe(dataBase: Date, diaVencimento: number, totalParcelas: number, parcelaInicial: number)` que retorna array de datas recalculadas

### Fluxo do recalculo ao editar parcela 1

```text
Usuario edita parcela 1 -> muda data para 15/02/2026
  -> Checkbox "Recalcular demais parcelas" marcado
  -> Salvar
  -> Parcela 1: 15/02/2026 (nova data do usuario) -- em fevereiro ja nesse mes
  -> Parcela 2: 15/03/2026 (proximo dia util)
  -> Parcela 3: 15/04/2026
  -> ... (todas as N parcelas restantes recalculadas)
  -> UPDATE em batch no banco
```

### Arquivos modificados
- `src/components/consorcio/ConsorcioCardForm.tsx` — datepicker para primeiro pagamento
- `src/types/consorcio.ts` — novo campo no input
- `src/hooks/useConsorcio.ts` — logica de geracao usando data_primeiro_pagamento
- `src/components/consorcio/EditInstallmentDialog.tsx` — opcao de recalcular ao editar parcela 1
- `src/components/consorcio/ConsorcioCardDrawer.tsx` — handler de recalculo em batch
- `src/lib/businessDays.ts` — funcao auxiliar de recalculo
