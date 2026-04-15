

## Diagnóstico: Janela de R2 desalinhada com a Safra

### Problema atual
Para a safra **09/04-15/04** (Qui→Qua), a janela de R2 está calculada como **Sex 03/04 12:00 → Sex 10/04 12:00** (semana ANTERIOR). Isso significa que a lista mostra R2s da semana passada, não da semana atual.

O cálculo atual em `getCarrinhoMetricBoundaries`:
```
currentFriday = weekStart + 1 dia = Sex 10/04
previousFriday = currentFriday - 7 = Sex 03/04
r2Meetings = previousFriday cutoff → currentFriday cutoff  ← ERRADO
```

### Correção
Mover a janela de R2 para frente, alinhando com a safra:
```
currentFriday = weekStart + 1 dia = Sex 10/04
nextFriday = currentFriday + 7 = Sex 17/04
r2Meetings = currentFriday cutoff → nextFriday cutoff  ← CORRETO (10/04 → 17/04)
```

Para safra 09-15, isso captura R2s de **10/04 12:00 a 17/04 12:00** — ou seja, as R2s que acontecem durante a semana da safra.

### Alterações

**`src/lib/carrinhoWeekBoundaries.ts`**
- Adicionar `nextFriday = addDays(currentFriday, 7)`
- Calcular `nextFridayCutoff` usando o `horario_corte` do config atual
- Alterar `r2Meetings` e `aprovados` de `{ previousFridayCutoff → currentFridayCutoff }` para `{ currentFridayCutoff → nextFridayCutoff }`
- Atualizar os comentários JSDoc para refletir a nova janela

Essa mudança afeta automaticamente tanto os **KPIs** quanto as **listas**, pois ambos usam `getCarrinhoMetricBoundaries`.

