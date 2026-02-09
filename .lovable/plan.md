

# Logica de parcelas: contratacao = primeiro pagamento + controle do inicio da 2a parcela

## Resumo

A data de contratacao e a mesma data do primeiro pagamento (parcela 1 ja paga no ato). O usuario quer voltar a ter o campo "Dia de Vencimento" (numero) e ter controle sobre quando a 2a parcela comeca.

## O que muda para o usuario

### No Formulario de Cadastro
- **Manter o campo "Dia de Vencimento"** como input numerico (1 a 31) -- voltar ao comportamento anterior
- **Remover o datepicker** "Data do Primeiro Pagamento"
- **Adicionar um select** "Inicio da 2a Parcela" com as opcoes:
  - **"Proximo mes"** -- a 2a parcela vence no mes seguinte ao da contratacao
  - **"Pular 1 mes"** -- a 2a parcela vence 2 meses apos a contratacao (util quando contrata apos dia 16)
  - **"Automatico (dia 16)"** -- se a data de contratacao for apos dia 16, pula 1 mes; senao, proximo mes
- A **parcela 1** sempre tera data de vencimento = data de contratacao (ja paga)
- As **demais parcelas** serao calculadas a partir do inicio escolhido

### Exemplo visual

```text
Contratacao: 20/02/2026, Dia Vencimento: 15

Opcao "Proximo mes":
  Parcela 1: 20/02/2026 (paga no ato)
  Parcela 2: 17/03/2026 (dia 15 ajustado para dia util)
  Parcela 3: 15/04/2026

Opcao "Pular 1 mes":
  Parcela 1: 20/02/2026 (paga no ato)
  Parcela 2: 15/04/2026 (pulou marco)
  Parcela 3: 15/05/2026

Opcao "Automatico (dia 16)":
  Se contratou dia 20 (> dia 16): mesmo que "Pular 1 mes"
  Se contratou dia 10 (<= dia 16): mesmo que "Proximo mes"
```

## Alteracoes tecnicas

### 1. Schema do formulario (`ConsorcioCardForm.tsx`)
- Remover campo `data_primeiro_pagamento` do schema zod
- Manter `dia_vencimento: z.number().min(1).max(31)` (ja existe)
- Adicionar `inicio_segunda_parcela: z.enum(['proximo_mes', 'pular_mes', 'automatico'])` com default `'automatico'`
- Remover o datepicker de "Data do Primeiro Pagamento" do JSX
- Adicionar de volta o input numerico de "Dia de Vencimento"
- Adicionar o select "Inicio da 2a Parcela" ao lado

### 2. Tipo de input (`types/consorcio.ts`)
- Remover `data_primeiro_pagamento` do `CreateConsorcioCardInput`
- Adicionar `inicio_segunda_parcela?: 'proximo_mes' | 'pular_mes' | 'automatico'`

### 3. Geracao de parcelas (`useConsorcio.ts`)
- Parcela 1: data_vencimento = data_contratacao (sempre)
- Parcela 2 em diante: calcular com base no `inicio_segunda_parcela`:
  - `'proximo_mes'`: offset de 1 mes a partir da contratacao
  - `'pular_mes'`: offset de 2 meses a partir da contratacao
  - `'automatico'`: se dia da contratacao > 16, usa offset 2; senao offset 1
- Parcela N = mes base + (N-2) + offset, ajustado para dia util

### 4. Manter recalculo ao editar parcela 1 no drawer
- A funcionalidade de editar parcela 1 e recalcular as demais no `EditInstallmentDialog` e `ConsorcioCardDrawer` continua funcionando normalmente

### Arquivos modificados
- `src/components/consorcio/ConsorcioCardForm.tsx` -- remover datepicker, adicionar select de inicio
- `src/types/consorcio.ts` -- trocar campo no input type
- `src/hooks/useConsorcio.ts` -- logica de geracao com parcela 1 = contratacao + offset configuravel

