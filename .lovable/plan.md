
# Corrigir Travamento da Semana Customizada no Carrinho R2

## Problema

Dois bugs combinados causam o travamento:

1. **Instabilidade de referencia**: O hook `useCarrinhoWeekOverride` retorna objetos `Date`, que quebram o "structural sharing" do React Query. Cada re-render recebe uma nova referencia, causando cascata de re-renders que trava a pagina.

2. **Hooks ignoram o override**: Os hooks de dados (`useR2CarrinhoKPIs`, `useR2CarrinhoData`, `useR2ForaDoCarrinhoData`, `useR2CarrinhoVendas`) recebem `weekDate` e internamente calculam as datas via `getCustomWeekStart/End`, ignorando completamente as datas customizadas. Apenas `useR2MeetingsExtended` usa as datas do override.

## Solucao

### 1. Estabilizar o hook de override (`useCarrinhoWeekOverride.ts`)

Retornar strings formatadas (`yyyy-MM-dd`) em vez de objetos `Date`. Strings sao comparaveis por valor e o React Query consegue fazer structural sharing corretamente, evitando re-renders desnecessarios.

### 2. Modificar hooks para aceitar datas explicitas

Alterar a assinatura dos 4 hooks de dados para aceitar `weekStart` e `weekEnd` como parametros (em vez de `weekDate`), eliminando o calculo interno via `getCustomWeekStart/End`:

- `useR2CarrinhoKPIs(weekStart: Date, weekEnd: Date)`
- `useR2CarrinhoData(weekStart: Date, weekEnd: Date, filter?)`
- `useR2ForaDoCarrinhoData(weekStart: Date, weekEnd: Date)`
- `useR2CarrinhoVendas(weekStart: Date, weekEnd: Date)`

### 3. Atualizar R2Carrinho.tsx

Calcular `weekStart`/`weekEnd` uma unica vez na pagina (considerando o override) e passar para todos os hooks.

## Detalhes Tecnicos

### Arquivo: `src/hooks/useCarrinhoWeekOverride.ts`

- Retornar `{ start: string, end: string, label: string }` (strings ISO) em vez de `{ start: Date, end: Date, label: string }`
- Isso garante estabilidade de referencia no React Query

### Arquivo: `src/hooks/useR2CarrinhoKPIs.ts`

- Mudar assinatura de `useR2CarrinhoKPIs(weekDate: Date)` para `useR2CarrinhoKPIs(weekStart: Date, weekEnd: Date)`
- Remover calculo interno de `getCustomWeekStart/End`

### Arquivo: `src/hooks/useR2CarrinhoData.ts`

- Mudar assinatura de `useR2CarrinhoData(weekDate, filter)` para `useR2CarrinhoData(weekStart, weekEnd, filter)`
- Remover calculo interno de `getCustomWeekStart/End`

### Arquivo: `src/hooks/useR2ForaDoCarrinhoData.ts`

- Mudar assinatura de `useR2ForaDoCarrinhoData(weekDate)` para `useR2ForaDoCarrinhoData(weekStart, weekEnd)`
- Remover calculo interno

### Arquivo: `src/hooks/useR2CarrinhoVendas.ts`

- Mudar assinatura de `useR2CarrinhoVendas(weekDate)` para `useR2CarrinhoVendas(weekStart, weekEnd)`
- Remover calculo interno

### Arquivo: `src/pages/crm/R2Carrinho.tsx`

- Converter override strings para `Date` com `parseISO` (uma vez, memoizado)
- Passar `weekStart`/`weekEnd` para todos os hooks em vez de `weekDate`
- Tambem ajustar `R2MetricsPanel` para receber `weekStart`/`weekEnd`

### Arquivo: `src/components/crm/R2MetricsPanel.tsx`

- Verificar se usa `weekDate` internamente e ajustar para receber `weekStart`/`weekEnd`

## Resultado

- Sem travamento: strings sao estaveis no React Query
- Dados corretos: todos os hooks usam as datas do override quando ativo
- KPIs, listas e metricas refletem a semana customizada corretamente
