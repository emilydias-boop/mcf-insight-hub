

## Problema

A função `dateMatchesCarrinho` filtra por dia da semana **E** horário de corte. Quando o corte é 12:00, qualquer R2 agendada às 15:00, 16:00, 18:00 etc. é excluída — o que não faz sentido. Reuniões como as das 15:00 e 16:00 de segunda-feira (visíveis no screenshot) somem ao selecionar um carrinho.

O "horário de corte" e "horário da reunião" devem ser **informativos** (indicam quando acontece a reunião do carrinho), não critérios de filtro sobre o horário da R2 individual.

## Solução

### 1. `src/hooks/useCarrinhoConfig.ts` — Simplificar `dateMatchesCarrinho`
- Filtrar **apenas por dia da semana** — remover a lógica de horário de corte
- O campo `horario_corte` e `horario_reuniao` continuam sendo salvos na config (informativos para a equipe saber quando é a reunião)

```typescript
export function dateMatchesCarrinho(scheduledAt: string | Date, carrinho: CarrinhoItem): boolean {
  const date = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt;
  const dayOfWeek = getDay(date);
  return carrinho.dias.includes(dayOfWeek);
}
```

### 2. `src/components/crm/CarrinhoConfigDialog.tsx` — Melhorar labels
- Renomear "Horário de corte" para "Horário da reunião do carrinho" (ou similar) para deixar claro que é informativo
- Atualizar a descrição de "R2s antes desse horário entram neste carrinho" para algo como "Horário em que acontece a reunião do carrinho"
- Possivelmente unificar os dois campos em um só ("Horário da reunião") já que ambos tinham o mesmo propósito confuso

