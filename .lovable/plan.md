

# Corrigir navegação de volta no Fechamento Consórcio

## Problema

Dois problemas combinados:

1. **Lista → Detalhe**: `Fechamento.tsx` navega para `/consorcio/fechamento/{id}` sem passar o mês selecionado
2. **Detalhe → Lista**: `FechamentoDetail.tsx` volta para `/consorcio/fechamento` sem o mês, então a lista reseta para o mês atual
3. **Lista ignora URL**: `Fechamento.tsx` usa `useState(currentMonth)` e nunca lê query params da URL

O Incorporador já resolve isso com `?from=2026-03&bu=incorporador` nos links.

## Solução

### Arquivo 1: `src/pages/bu-consorcio/Fechamento.tsx`
- Importar `useSearchParams`
- Inicializar `anoMes` a partir de `searchParams.get('month')` (fallback: mês atual)
- Ao navegar para o detalhe do closer, passar `?from={anoMes}` na URL: `/consorcio/fechamento/${payout.id}?from=${anoMes}`
- Mesma lógica para SDRs (navega para `/fechamento-sdr/${id}?from=${anoMes}&bu=consorcio`)

### Arquivo 2: `src/pages/bu-consorcio/FechamentoDetail.tsx`
- Importar `useSearchParams`
- Ler `fromMonth` de `searchParams.get('from')`
- Botão voltar: navegar para `/consorcio/fechamento?month={fromMonth}` (com fallback para sem param)

## Resultado esperado
- Ao abrir Victoria (março) e clicar voltar, retorna para a lista em março
- A URL reflete o mês selecionado, permitindo compartilhamento de links

