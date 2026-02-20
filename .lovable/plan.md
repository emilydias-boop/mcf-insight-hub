

# Navegacao Independente do Override

## Problema

Ao clicar em "proxima semana" ou "semana anterior", o sistema **exclui a excecao do banco de dados**. Isso impede o usuario de voltar a semana customizada e perde a configuracao salva.

## Causa

Os handlers `handlePrevWeek`, `handleNextWeek` e `handleToday` chamam `removeOverride.mutate()`, que deleta o registro da tabela `settings`. Alem disso, o `weekStart/weekEnd` e calculado com prioridade para o override -- entao enquanto o override existe no banco, navegar com `setWeekDate` nao tem efeito.

## Solucao

Introduzir um estado local `ignoreOverride` que permite ao usuario navegar livremente sem deletar a excecao do banco:

1. Adicionar `const [ignoreOverride, setIgnoreOverride] = useState(false)`
2. O calculo de `weekStart`/`weekEnd` passa a considerar o override apenas quando `!ignoreOverride`
3. Botoes anterior/proximo/hoje ativam `ignoreOverride = true` e navegam normalmente (sem deletar nada do banco)
4. O botao de "Ajustar Semana" (CalendarCog) continua abrindo o dialog para editar/remover a excecao
5. Quando uma nova excecao e salva, resetar `ignoreOverride = false` para que o override volte a ser respeitado

### Arquivo: `src/pages/crm/R2Carrinho.tsx`

**Adicionar estado:**
```
const [ignoreOverride, setIgnoreOverride] = useState(false);
```

**Alterar calculo de weekStart/weekEnd:**
```
const activeOverride = override && !ignoreOverride;
const weekStart = useMemo(() =>
  activeOverride ? parseISO(override.start) : getCustomWeekStart(weekDate),
  [activeOverride, override, weekDate]
);
const weekEnd = useMemo(() =>
  activeOverride ? parseISO(override.end) : getCustomWeekEnd(weekDate),
  [activeOverride, override, weekDate]
);
```

**Simplificar handlers (sem deletar override):**
```
handlePrevWeek:
  se activeOverride -> setIgnoreOverride(true) + setWeekDate(subWeeks(parseISO(override.start), 1))
  senao -> setWeekDate(subWeeks(weekDate, 1))

handleNextWeek:
  se activeOverride -> setIgnoreOverride(true) + setWeekDate(addWeeks(parseISO(override.start), 1))
  senao -> setWeekDate(addWeeks(weekDate, 1))

handleToday:
  setIgnoreOverride(true)
  setWeekDate(new Date())
```

**Badge de override visivel mesmo navegando:**
Manter o indicador "Semana customizada" visivel quando `override` existe (independente de `ignoreOverride`), para o usuario saber que ainda ha uma excecao salva.

**Ao salvar nova excecao no dialog:**
Resetar `setIgnoreOverride(false)` no callback `onSave` para que a nova excecao seja imediatamente aplicada.

## Resultado

- Navegar entre semanas **nao exclui** a excecao do banco
- O usuario pode ir e voltar livremente, e ao clicar no botao de calendario, a excecao ainda esta la
- Salvar uma nova excecao a aplica imediatamente
- Remover excecao pelo dialog continua funcionando normalmente
