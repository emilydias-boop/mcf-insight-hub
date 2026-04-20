

## Ajuste no plano: janela de Vendas Parceria

Confirmado o restante do plano. Único ajuste é na janela de **Vendas Parceria**.

### Regra correta de Vendas Parceria

- **Início**: Sex no corte (12:00) — logo após o fechamento do carrinho
- **Fim**: Segunda 23:59 — para captar boletos que caem com atraso

Para a safra Qui 09/04 → Qua 15/04 (carrinho Sex 17/04 12:00):
- Vendas Parceria: **Sex 17/04 12:00 → Seg 20/04 23:59**

### Mudança em `src/lib/carrinhoWeekBoundaries.ts`

```text
// ANTES (errado):
vendasParceria: { start: thuStart, end: currentFridayCutoff - 1ms }
// = Qui 09/04 00:00 → Sex 10/04 11:59 ❌

// DEPOIS (correto):
const monday = addDays(currentFriday, 3)  // Sex+3 = Segunda
const mondayEnd = endOfDay(monday)         // Seg 23:59:59.999
vendasParceria: { start: currentFridayCutoff, end: mondayEnd }
// = Sex 17/04 12:00 → Seg 20/04 23:59 ✅
```

⚠️ Nota: como `currentFridayCutoff` agora aponta pra Sex DA safra (10/04) e o corte real do carrinho desta safra é na sexta seguinte (17/04 = `nextFridayCutoff`), a janela de Vendas Parceria precisa usar `nextFridayCutoff` como início, não `currentFridayCutoff`.

Versão final:
```text
const nextMonday = addDays(nextFriday, 3)  // Sex+1 + 3 = Seg da semana seguinte
vendasParceria: { 
  start: nextFridayCutoff,                  // Sex 17/04 12:00 (corte deste carrinho)
  end: localEndOfDay(nextMonday)            // Seg 20/04 23:59
}
```

## Plano consolidado (4 mudanças cirúrgicas)

### 1. `src/lib/carrinhoWeekBoundaries.ts` — duas correções

**A) Vendas Parceria** (esta nova):
```text
vendasParceria: { 
  start: nextFridayCutoff,           // Sex 17/04 12:00
  end: localEndOfDay(nextMonday)     // Seg 20/04 23:59
}
```

**B) Adicionar nova janela `carrinhoOperacional`** (do plano anterior):
```text
carrinhoOperacional: { 
  start: previousFridayCutoff,   // Sex 10/04 12:00 (corte do carrinho anterior)
  end: nextFridayCutoff          // Sex 17/04 12:00 (corte deste carrinho)
}
```

Manter intactos: `r2Meetings`, `aprovados`, `contratos`, `r1Meetings`, `previousCutoff`.

### 2. `src/hooks/useR2CarrinhoData.ts` — filtro operacional para R2s

Aplicar `carrinhoOperacional` (com bypass para encaixados) apenas em `agendadas`, `realizadas`, `no_show`. Não tocar em `aprovados`/`aprovados_proxima_safra`.

### 3. `src/hooks/useR2CarrinhoKPIs.ts` — mesma filtragem

Aplicar `carrinhoOperacional` em `r2Agendadas`, `r2Realizadas`, `foraDoCarrinho`. Manter intactos: `aprovados`, `aprovadosForaCorte`, `contratosPagos`, `pendentes`, `emAnalise`.

### 4. `src/hooks/useR2ForaDoCarrinhoData.ts` — mesma filtragem

Aplicar `carrinhoOperacional` para evitar mostrar leads "fora" da semana passada.

### 5. `src/hooks/useR2CarrinhoVendas.ts` (se existir consumo da janela vendas) — receber nova janela

Confirmar que a aba de Vendas usa `vendasParceria` da nova janela (Sex corte → Seg 23:59).

### 6. UI — atualizar header em `R2Carrinho.tsx`

Mostrar três janelas para clareza:
```
Janela do Carrinho (R2s):  10/04 12:00 → 17/04 12:00
Janela de Vendas Parceria: 17/04 12:00 → 20/04 23:59
Safra (contratos):         09/04 00:00 → 15/04 23:59
```

## Resultado esperado

| Métrica | Janela | Antes | Depois |
|---|---|---|---|
| Contratos (R1) | Qui→Qua | 64 | 64 |
| R2 Agendadas | Sex→Sex 12h | 85 | ~65 |
| R2 Realizadas | Sex→Sex 12h | 73 | ~57 |
| Fora do Carrinho | Sex→Sex 12h | 14 | recalculado |
| **Aprovados** | Qui→Sex+1 12h | 49 | 49 ✅ |
| Próxima Safra | Qui→Sex+1 12h | 10 | 10 |
| **Vendas Parceria** | **Sex+1 12h→Seg 23:59** | (errado) | janela correta de boletos atrasados |

## Escopo

- 5 arquivos editados, ~40 linhas
- Zero mudança na RPC
- Zero impacto no Relatório
- Aprovados/Próxima Safra ficam intocados (continua batendo com sua lista)

