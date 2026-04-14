

## Plano: Corrigir boundaries R2 no relatório (e no dashboard)

### Causa raiz encontrada

O relatório usa **boundary de cutoff** (Sexta 12:00 BRT → Sexta 12:00 BRT) para contar R2 Agendadas/Realizadas. Isso **exclui 5 reuniões na sexta-feira à tarde** (após 12:00 BRT). O cutoff serve para determinar a qual SAFRA do carrinho a reunião pertence, mas para contar agendadas/realizadas, deveria usar a **semana operacional completa** (Sáb 00:00 BRT → Sex 23:59 BRT).

### Verificação no banco

| Boundary | Agendadas | Realizadas |
|----------|-----------|------------|
| Cutoff (atual) | 43 + 4 enc = **47** | **43** |
| Semana completa | 49 + 3 enc = **52** ✓ | **45** ✓ |

As 5 reuniões faltantes estão na sexta 10/04 entre 15:00-22:00 UTC (12:00-19:00 BRT).

### Correção em `supabase/functions/weekly-manager-report/index.ts`

**Alterar o boundary R2 de cutoff para semana operacional completa:**

```ts
// ANTES: cutoff-based
const r2Start = new Date(previousFriday);
r2Start.setHours(prevCutH + 3, prevCutM, 0, 0);
const r2End = new Date(currentFriday);
r2End.setHours(currCutH + 3, currCutM, 0, 0);

// DEPOIS: full operational week (Sáb 00:00 BRT → Sex 23:59 BRT)
const r2Start = new Date(labels.carrinhoStart); // Saturday
r2Start.setHours(3, 0, 0, 0); // 00:00 BRT = 03:00 UTC
const r2End = new Date(labels.carrinhoEnd); // Friday
r2End.setHours(26, 59, 59, 999); // 23:59 BRT = 02:59 UTC next day
```

### Discrepâncias pendentes

| Métrica | Com semana completa | Usuário espera | Diferença |
|---------|-------------------|----------------|-----------|
| Agendadas | **52** | 52 | ✓ |
| Realizadas | **45** | 45 | ✓ |
| Aprovados | **31** | 35 | **-4** |
| Próx. Semana | **3** | 3 | ✓ |
| Fora Carrinho | **7** (6 reembolso + 1 reprovado) | 2 | **-5** |

**Aprovados (31 vs 35)**: No banco existem 31 attendees com `r2_status_id = Aprovado`. Os 4 encaixados já estão incluídos. Não encontrei mais 4 aprovados. Possível que 4 leads foram aprovados operacionalmente mas ainda não tiveram o status atualizado no sistema.

**Fora do Carrinho (7 vs 2)**: O relatório conta Reembolso(6) + Desistente(0) + Reprovado(1) + Cancelado(0) = 7. O usuário diz que deveria ser 2 — preciso entender qual é a definição correta de "fora do carrinho" para o relatório.

### Ação

1. Corrigir o boundary R2 para semana operacional completa → resolve Agendadas (52) e Realizadas (45)
2. Deploy e enviar para Bellini com `buFilter: "incorporador"`
3. Investigar com o usuário a diferença nos Aprovados e Fora do Carrinho

