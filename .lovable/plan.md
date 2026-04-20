

## Diagnóstico do bug

Confirmei na tela "Janela do Carrinho (R2s): **03/04** 12:00 → 17/04 12:00" (14 dias!). Era pra ser **10/04** 12:00 → 17/04 12:00 (7 dias).

Causa: em `carrinhoWeekBoundaries.ts` linha 99, `previousFriday = subDays(weekStart, 6)`. Para a safra Qui 09/04, isso dá Sex 03/04 (sexta da semana retrasada), não Sex 10/04 (sexta DA safra = corte do carrinho anterior real).

A regra que você descreveu:
- Safra Qui 09/04 → Qua 15/04
- Carrinho **abre** Sex **10/04** 12:00 (corte da safra anterior, que era Qui 02 → Qua 08)
- Carrinho **fecha** Sex **17/04** 12:00 (corte desta safra)

Hoje o código está pegando a sexta da safra retrasada (03/04) como abertura → janela de 14 dias → todas as 85 R2s passam → KPIs e lista não são filtrados.

## Correção (1 arquivo, 1 linha)

### `src/lib/carrinhoWeekBoundaries.ts`

Trocar a janela `carrinhoOperacional` para usar **a sexta DA safra atual** como início (não a sexta da semana anterior):

```text
// ANTES (errado — janela de 14 dias):
carrinhoOperacional: { 
  start: previousFridayCutoff,   // Sex 03/04 12:00 ❌
  end: nextFridayCutoff          // Sex 17/04 12:00
}

// DEPOIS (correto — janela de 7 dias):
carrinhoOperacional: { 
  start: currentFridayCutoff,    // Sex 10/04 12:00 ✅
  end: nextFridayCutoff          // Sex 17/04 12:00 ✅
}
```

`currentFridayCutoff` já existe no arquivo (linha 106) — é a Sexta da MESMA semana da safra (Qui+1).

Não mexer em mais nada. Os hooks (`useR2CarrinhoData`, `useR2CarrinhoKPIs`, `useR2ForaDoCarrinhoData`) já consomem `carrinhoOperacional` corretamente — só estão recebendo a janela errada.

## Resultado esperado após o ajuste

| Item | Antes | Depois |
|---|---|---|
| Header "Janela do Carrinho (R2s)" | 03/04 12:00 → 17/04 12:00 ❌ | **10/04 12:00 → 17/04 12:00** ✅ |
| KPI "R2 Agendadas" | 85 | ~65 |
| KPI "R2 Realizadas" | 73 | ~57 |
| KPI "Fora do Carrinho" | 14 | recalculado na janela certa |
| Aba "Todas R2s" (contagem) | 85 | ~65 (some os leads do dia 09/04 que pertenciam ao carrinho anterior) |
| KPI "Aprovados" | 49 | 49 (intacto — usa janela ampla) |
| KPI "Próxima Safra" | 10 | 10 (intacto) |
| KPI "Contratos (R1)" | 64 | 64 (intacto) |
| Aba Vendas Parceria | OK | OK (já usa `nextFridayCutoff → nextMonday`) |

## Por que o problema não era de front (cache)

O front estava chamando o hook certo, mas o hook estava recebendo uma janela operacional de 14 dias em vez de 7. Como a RPC já retorna 85 R2s da janela ampla (Qui→Sex+1), o filtro extra `inOperationalWindow` não conseguia descartar nada porque sua janela cobria os mesmos 14 dias. Não é cache — é cálculo de boundary.

## Escopo

- 1 arquivo, 1 linha trocada (`previousFridayCutoff` → `currentFridayCutoff` na propriedade `carrinhoOperacional.start`)
- Zero impacto em RPC, Aprovados, Próxima Safra, Vendas Parceria ou Relatório

