

## Plano: Corrigir datas e números do relatório Incorporador

### Problema

O relatório usa uma única janela Thu-Wed para tudo. Na verdade existem dois períodos:
- **Semana do Carrinho** (Sáb-Sex): e.g. 04/04-10/04 — usado para R1, R2, SDR, Closers
- **Safra de Contratos** (Qui-Qua): e.g. 02/04-08/04 — usado apenas para contratos pagos

Além disso:
- R2 Agendadas conta `pre_scheduled` indevidamente — deve excluir
- Contratos não mostram breakdown visual (total com reembolso vs líquido)
- "Fora do Carrinho" mistura próxima semana no total

### Alterações em `supabase/functions/weekly-manager-report/index.ts`

**1. Novo cálculo de datas**

Substituir `getIncorpWeek()` por uma função que retorna dois ranges:

```text
getIncorpPeriods() → {
  carrinhoWeek: { start: Sat, end: Fri }    // Sáb 00:00 → Sex 23:59
  safraContratos: { start: Thu, end: Wed }   // Qui 00:00 → Qua 23:59 (Thu = Sat - 2 days)
}
```

- O label do período mostrará a semana do carrinho (Sáb-Sex)
- Contratos usam `safraContratos`
- R1, R2, SDR, Closers, Financeiro usam `carrinhoWeek`

**2. Contratos — breakdown visual**

- Contar total de contratos (completed + refunded) = "Total com Reembolsos"
- Contar refunded separadamente
- Calcular líquido = total - reembolsos
- Mostrar mini gráfico de pizza ou cards lado a lado: "38 Total → 11 Reembolsos → 27 Líquidos" com cores verde/vermelho

**3. R2 Agendadas — excluir pre_scheduled**

Adicionar filtro: `att.status !== 'pre_scheduled'` ao contar R2 agendadas (além de cancelled/rescheduled já existentes).

**4. Fora do Carrinho — separação clara**

Manter contagem separada:
- `proximaSemana` (status Próxima Semana)
- `foraDoCarrinho` = reprovados + reembolsos + desistentes + cancelados (sem incluir próxima semana)

Atualmente `FORA_IDS` inclui `PROXIMA_SEMANA_ID` — remover de lá e contar separadamente.

### Resultado esperado (semana 04/04-10/04)

- Contratos: 38 total, 11 reembolsos, 27 líquidos
- R2 Agendadas: 52 (sem pre_scheduled)
- R2 Realizadas: 49
- Aprovados: 35
- Próxima Semana: 3
- Fora do Carrinho: 2 (1 reprovado + 1 reembolso)

