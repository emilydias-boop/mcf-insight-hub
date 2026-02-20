
# Permitir Navegacao de Semanas com Override Ativo

## Problema

Os botoes de navegacao (anterior, proximo, hoje) estao desabilitados quando existe um override de semana customizada. O usuario precisa navegar entre semanas mesmo com override ativo, e tambem precisa configurar um novo carrinho de terca (24/02) ate sexta (28/02) para fechar o mes.

## Causa

Linhas 120, 124 e 132 de `R2Carrinho.tsx` tem `disabled={!!override}`, bloqueando toda navegacao quando o override esta ativo.

## Solucao

Quando o usuario clicar nos botoes de navegacao (anterior, proximo, hoje) enquanto houver um override ativo, o sistema deve **limpar o override automaticamente** e navegar normalmente. Isso permite que o usuario saia da semana customizada a qualquer momento sem precisar abrir o dialog de configuracao.

## Alteracao

### Arquivo: `src/pages/crm/R2Carrinho.tsx`

1. Remover `disabled={!!override}` dos 3 botoes de navegacao
2. Nos handlers `handlePrevWeek`, `handleNextWeek` e `handleToday`, adicionar logica para limpar o override se estiver ativo antes de navegar:

```text
handlePrevWeek:
  se override ativo -> removeOverride + setWeekDate para uma semana antes do override.start
  senao -> setWeekDate(subWeeks(weekDate, 1))

handleNextWeek:
  se override ativo -> removeOverride + setWeekDate para uma semana depois do override.start
  senao -> setWeekDate(addWeeks(weekDate, 1))

handleToday:
  se override ativo -> removeOverride
  setWeekDate(new Date())
```

## Sobre o Proximo Carrinho

Para configurar o carrinho de terca 24/02 ate sexta 28/02 (fechando o mes), voce pode usar o mesmo botao de "Ajustar Semana" (icone de calendario) e definir as datas inicio=24/02 e fim=28/02. O dialog ja suporta isso.

## Resultado

- Botoes de navegacao sempre habilitados
- Clicar em anterior/proximo com override ativo limpa o override e navega normalmente
- Facil alternar entre semana customizada e navegacao padrao
