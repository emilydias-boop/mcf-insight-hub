

# Corrigir Dialog de Semana Customizada Nao Atualizando

## Problema

O `CarrinhoWeekOverrideDialog` usa `useState` para inicializar os campos de data e label (linhas 24-26). O `useState` so define o valor inicial na **primeira montagem** do componente. Como o Dialog do Radix mantem o componente montado mesmo quando fechado, ao reabrir o dialog os campos mostram valores desatualizados ou vazios.

## Solucao

Adicionar um `useEffect` no `CarrinhoWeekOverrideDialog` que sincroniza o estado local (`startDate`, `endDate`, `label`) sempre que o dialog abrir (`open === true`) ou quando `currentOverride` mudar.

## Alteracao

### Arquivo: `src/components/crm/CarrinhoWeekOverrideDialog.tsx`

Adicionar apos as linhas 24-26 (os useState):

```typescript
useEffect(() => {
  if (open) {
    setStartDate(currentOverride?.start);
    setEndDate(currentOverride?.end);
    setLabel(currentOverride?.label || '');
  }
}, [open, currentOverride]);
```

Tambem adicionar `useEffect` ao import do React (linha 1).

## Resultado

- Ao abrir o dialog, os campos sempre refletem o override atual do banco
- Salvar e reabrir mostra os valores corretos
- Sem dados desatualizados ou campos vazios

