

## Plano: Excluir leads encaixados em outra semana da lista atual

### Problema
Quando um lead tem `carrinho_week_start` definido (foi encaixado manualmente em uma semana específica), ele ainda aparece em outras semanas via `fetchAttendeesFromQuery` se o `scheduled_at` cair na janela de datas. Resultado: leads encaixados na semana anterior aparecem na semana atual.

### Causa raiz
`fetchAttendeesFromQuery` filtra apenas por `scheduled_at` dentro da boundary, ignorando completamente o campo `carrinho_week_start`. Então um lead com `carrinho_week_start = 2026-04-02` mas `scheduled_at` dentro da janela 10/04-17/04 aparece na safra 09-15.

### Solução
No loop de processamento de `fetchAttendeesFromQuery`, adicionar verificação: se o attendee tem `carrinho_week_start` preenchido e esse valor **não** é igual ao `weekStartStr` da semana atual, excluí-lo da lista. Isso garante que leads encaixados só apareçam na semana para a qual foram designados.

### Alterações

**`src/hooks/useR2CarrinhoData.ts`**

1. Passar `weekStartStr` como parâmetro para `fetchAttendeesFromQuery`
2. Incluir `carrinho_week_start` no select da query (via cast, como já feito em `fetchEncaixadosForWeek`)
3. No loop de processamento, adicionar filtro:
```ts
// Se tem carrinho_week_start definido e é de outra semana, pular
const attWeekStart = (att as any).carrinho_week_start;
if (attWeekStart && attWeekStart !== weekStartStr) continue;
```

Isso funciona em conjunto com `fetchEncaixadosForWeek` que já traz os encaixados corretos para a semana atual.

