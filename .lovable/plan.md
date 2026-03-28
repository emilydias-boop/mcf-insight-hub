

## Fix: Fronteiras da semana do carrinho devem usar meia-noite de sábado

### Problema

A função `getCarrinhoWeekBoundaries` usa o `horario_corte` (12:00) para definir quando a semana começa e termina. Isso faz vendas de sexta após 12:00 caírem na semana seguinte. 

O correto segundo a regra de negócio:
- Vendas de sexta (mesmo após 12:00) pertencem à semana **atual**
- A semana só muda à **meia-noite de sábado** (00:00)
- O `horario_corte` define apenas quando acontece a reunião do carrinho, **não** a fronteira da semana

### Correção

**`src/lib/carrinhoWeekBoundaries.ts`**:

Alterar a lógica para usar o início do sábado (weekStart) como `effectiveStart` e o início do próximo sábado como `effectiveEnd`:

```typescript
// effectiveStart = weekStart (sábado) à 00:00
const effectiveStart = new Date(weekStart);
effectiveStart.setHours(0, 0, 0, 0);

// effectiveEnd = próximo sábado à 00:00 (weekEnd + 1 dia)
const effectiveEnd = addDays(new Date(weekEnd), 1);
effectiveEnd.setHours(0, 0, 0, 0);
```

Atualizar imports (`addDays` em vez de `subDays`) e o JSDoc.

### Arquivo alterado
- `src/lib/carrinhoWeekBoundaries.ts`

