

## Diagnóstico definitivo (validado contra os 44 nomes)

Rodei a RPC e o banco com a sua lista oficial. Resultado por janela de R2:

| Janela testada | Aprovados encontrados |
|---|---|
| **Front HOJE** (Qui 16 00:00 → Sex 17 12:00 BRT) | 20 ❌ |
| Sáb 11/04 → Sex 17/04 12:00 | 42 |
| Sex 10/04 12:00 → Sex 17/04 12:00 (corte a corte) | 43 |
| **Qui 09/04 00:00 → Sex 17/04 12:00** | **44 ✅** |

**A regra correta**, conforme você descreveu:

- **Safra (contratos)**: Qui 09/04 00:00 → Qua 15/04 23:59 (data do contrato R1)
- **Janela do R2 do Carrinho**: Qui 09/04 00:00 → **Sex 17/04 12:00** (sexta DA SEMANA SEGUINTE no corte) — porque o R2 pode acontecer na semana inteira e fechar na sexta às 12h
- **Encaixados**: leads com `carrinho_week_start = 09/04` entram independentemente da janela
- **Próxima safra**: aprovados com R2 nessa janela MAS contrato fora do corte

**Onde codei errado**: na minha última correção mudei `r2Meetings.end` para a sexta DA safra (Sex 10/04 12:00) achando que era o corte da safra. Errado. O corte da semana do carrinho é a **sexta seguinte** (Sex 17/04 12:00) — e foi por isso que caímos de 38 → 13. Preciso reverter essa parte.

## Mapeamento dos 4 cálculos (carrinho R2 ↔ Relatório)

| Métrica | Origem | Janela usada | Status final |
|---|---|---|---|
| Aprovados (Carrinho R2) | RPC `get_carrinho_r2_attendees` | Qui da safra → Sex+1 12:00 | **deve dar 44** |
| Aprovado R2 Carrinho (Relatório) | mesma RPC | mesma janela | **deve dar 44** (idêntico) |
| Próxima Safra (ambas) | mesma RPC + `dentro_corte=false` | mesma janela | mesmo número nas duas |
| R2 Agendadas / Realizadas / Fora | mesma RPC | mesma janela | derivadas do mesmo conjunto |

Hoje as duas telas estão conectadas na mesma RPC (Fase 2 que fiz já unificou via `isCarrinhoEligible`). O problema restante é APENAS a janela passada pra RPC.

## Plano de correção (3 arquivos, mudança cirúrgica)

### 1. `src/lib/carrinhoWeekBoundaries.ts` — corrigir a janela de R2

Reverter `r2Meetings.end` e `aprovados.end` de `currentFridayCutoff` (Sex DA safra) para `nextFridayCutoff` (Sex+1 da semana do carrinho no corte):

```text
// ANTES (errado, da minha última mudança):
r2Meetings.end = currentFridayCutoff   // Sex 10/04 12:00 ❌

// DEPOIS (correto):
const nextFriday = addDays(weekStart, 8)  // Qui+8 = Sex da semana seguinte
r2Meetings.end = nextFridayCutoff      // Sex 17/04 12:00 ✅
aprovados.end = nextFridayCutoff       // idem
```

Manter:
- `r2Meetings.start = thuStart` (Qui 09/04 00:00)
- `previousCutoff = currentFridayCutoff` (Sex 10/04 12:00 = corte para `dentro_corte` na RPC)
- `vendasParceria.end = currentFridayCutoff - 1ms` (vendas até a sexta DA safra, não da seguinte)
- `contratos: Qui 00:00 → Qua 23:59` (safra de contratos)

### 2. Validação (sem código novo)

Após o ajuste:
- Carrinho R2 → "Aprovados" deve marcar **44** (ou bem próximo, dependendo de status atual de cada lead)
- Carrinho R2 → "Próxima Safra" deve refletir aprovados com R2 nessa janela mas contrato fora do corte (não vai sumir essa coluna)
- Relatório → "Aprovado (R2 Carrinho)" deve marcar o mesmo **44**
- Relatório → "Aprovado — Próxima Safra" deve bater com Carrinho R2

### 3. Não mexer (já está certo)

- A RPC `get_carrinho_r2_attendees` não precisa mudar — ela só recebe parâmetros
- `isCarrinhoEligible` e `isProximaSafra` em `useCarrinhoUnifiedData.ts` já estão corretos (Fase 2 ok)
- Os contadores de KPI e abas em `useR2CarrinhoKPIs.ts` e `useR2CarrinhoData.ts` já consomem a regra unificada
- `useR2CarrinhoVendas` continua hardcoded mas isso é problema de outra fase — **não bloqueia o número 44**

### Risco controlado

A única mudança é em **1 arquivo, 4 linhas** (`carrinhoWeekBoundaries.ts`). É exatamente reverter o erro que introduzi no último commit nessa parte específica. Não toca em RPC, não toca em hooks, não toca em UI.

### Esperado depois

- Carrinho R2 mostra **~44 aprovados** (idêntico à sua lista)
- Relatório mostra **~44 aprovados** no card "Aprovado (R2 Carrinho)"
- Próxima Safra fica como aba/card auxiliar para os que ficaram fora do corte de contrato

