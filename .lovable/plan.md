
## Diagnóstico real do problema

O que já está certo hoje:
- `src/pages/crm/R2Carrinho.tsx` já carrega **config da semana atual** e **config da semana anterior**.
- `useR2CarrinhoData`, `useR2CarrinhoKPIs`, `useR2ForaDoCarrinhoData` e `useR2CarrinhoVendas` já recebem `previousConfig` e já reagem ao `horario_corte` no `queryKey`.

O que está errado de fato:
1. **A sexta usada no cálculo está uma semana adiantada**
   - Em `src/lib/carrinhoWeekBoundaries.ts`, o início usa:
     ```ts
     const friAfterPrevCartDate = addDays(weekStart, 1)
     ```
     Para a semana `09/04 - 15/04`, isso vira **10/04**.
     Mas o início esperado da janela era a **sexta anterior: 03/04**.

   - O fim usa:
     ```ts
     const friCartCutoffDate = addDays(weekEnd, 2)
     ```
     Para `09/04 - 15/04`, isso vira **17/04**.
     Mas o fim esperado era a **sexta do carrinho dessa safra: 10/04**.

2. **O corte está sendo montado em UTC**
   - Hoje o helper usa `Date.UTC(...)`.
   - Então `12:00` vira **12:00 UTC**, que no Brasil aparece como **09:00 local**.
   - Isso bate com o sintoma do print: a lista está começando na sexta **10/04 às 09:00**, que é exatamente o efeito de “12:00 UTC”.

## Resumo do erro com o seu exemplo

Para a safra `09/04 - 15/04`, o esperado era:

```text
Esperado:
R2s da semana = 03/04 12:00 -> 10/04 12:00
```

Hoje o código está fazendo algo equivalente a:

```text
Atual:
R2s da semana = 10/04 09:00 local -> 17/04 09:00 local
```

Por isso:
- os leads feitos **após 12h da sexta anterior** não entram;
- a tela começa mostrando registros da **sexta atual às 09h**;
- parece que o corte “não respeita”, quando na prática a janela inteira está deslocada.

## Plano de correção

### 1) Corrigir a matemática da janela em `carrinhoWeekBoundaries.ts`
Trocar a lógica para usar a sexta correta da safra selecionada:

- `currentFriday = addDays(weekStart, 1)`  
- `previousFriday = subDays(currentFriday, 7)`

E montar:
- `previousFridayCutoff` com o `horario_corte` da `previousConfig`
- `currentFridayCutoff` com o `horario_corte` da `config`

Aplicando:
- `r2Meetings: { start: previousFridayCutoff, end: currentFridayCutoff }`
- `aprovados: { start: previousFridayCutoff, end: currentFridayCutoff }`

### 2) Parar de usar `Date.UTC` para o corte
Construir o horário de corte em **horário local do negócio** (12:00 real que o usuário configurou), para não deslocar 3 horas.

Objetivo:
- `12:00` configurado precisa virar **12:00 visível na regra**, não `09:00`.

### 3) Ajustar também a janela de vendas
A `vendasParceria` hoje também está baseada na sexta errada.
Ela deve passar a usar a **sexta do carrinho da safra selecionada**, não a sexta da semana seguinte.

### 4) Alinhar as views secundárias que ainda não seguem a mesma regra
Mesmo corrigindo a helper principal, ainda existem pontos do Carrinho que continuam incompletos:
- `src/hooks/useR2MetricsData.ts` recebe só a config atual
- `src/components/crm/R2MetricsPanel.tsx` não passa `previousConfig`
- `src/hooks/useR2AccumulatedLeads.ts` varre semanas anteriores sem usar as configs históricas dessas semanas

Plano:
- passar `previousConfig` para `R2MetricsPanel` / `useR2MetricsData`
- incluir os cortes no `queryKey`
- revisar `useR2AccumulatedLeads` para usar a config correta de cada semana escaneada

## Arquivos a ajustar

- `src/lib/carrinhoWeekBoundaries.ts`
- `src/pages/crm/R2Carrinho.tsx`
- `src/components/crm/R2MetricsPanel.tsx`
- `src/hooks/useR2MetricsData.ts`
- `src/hooks/useR2AccumulatedLeads.ts`

Possivelmente também, para manter tudo consistente:
- `src/hooks/useCloserCarrinhoMetrics.ts`
- `src/hooks/useSDRCarrinhoMetrics.ts`

## Validação após a correção

Cenário de teste:
- semana `02/04 - 08/04` com corte `12:00`
- abrir semana `09/04 - 15/04`

Resultado esperado:
- lead criado em `03/04 11:59` fica na semana anterior
- lead criado em `03/04 12:01` entra em `09/04 - 15/04`
- a lista não pode começar em `10/04 09:00` por efeito de UTC
- KPIs, “Todas R2s”, “Fora do Carrinho”, “Aprovados” e “Vendas” precisam bater com a mesma janela
