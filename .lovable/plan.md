

## Aplicar corte de horário nas janelas de Aprovados e Vendas

### Contexto

A separação conceitual ja esta correta: aprovados e vendas usam a janela operacional (Sex-Sex), nao a safra de contratos. O ponto pendente e que a sexta-feira do carrinho atual tem um **corte de horario** — aprovados sao apenas os que foram definidos **antes** do pitch/venda (tipicamente meio-dia), e vendas comecam **apos** esse horario.

O `CarrinhoConfig` ja possui o campo `horario_corte` (default `"12:00"`), que e exatamente esse corte.

### Mudancas

#### 1. `src/lib/carrinhoWeekBoundaries.ts`

Adicionar duas novas janelas ao `CarrinhoMetricBoundaries`:

```text
aprovados: {
  start: Sex pos-carrinho anterior 00:00,
  end: Sex do carrinho atual HH:mm (horario_corte do config)
}

vendasParceria: {
  start: Sex do carrinho atual HH:mm (horario_corte),
  end: Seg 23:59
}
```

Usar o `horario_corte` do `CarrinhoConfig` (default `12:00`) para definir o corte da sexta:
- Aprovados: Sex anterior 00:00 ate Sex atual 12:00 (ou config)
- Vendas: Sex atual 12:00 ate Seg 23:59

A janela `r2Meetings` existente (Sex 00:00 a Sex 23:59) permanece para uso geral (aba "Todas R2s").

#### 2. `src/hooks/useR2CarrinhoKPIs.ts`

KPI "Aprovados" usa `boundaries.aprovados` (com corte) em vez de `boundaries.r2Meetings` (sem corte).

#### 3. `src/hooks/useR2CarrinhoData.ts`

Quando `filter === 'aprovados'`: usar `boundaries.aprovados` (com corte na sexta).

#### 4. `src/hooks/useR2CarrinhoVendas.ts`

Usar `boundaries.vendasParceria` atualizado (que agora comeca no horario de corte da sexta, nao meia-noite).

### Resultado

```text
Exemplo: carrinho sexta 28/03, horario_corte = 12:00

Aprovados:  Sex 21/03 00:00 → Sex 28/03 12:00
Vendas:     Sex 28/03 12:00 → Seg 31/03 23:59
```

Aprovados capturados antes do pitch. Vendas capturadas apos o pitch. Sem sobreposicao.

### Arquivos alterados
1. `src/lib/carrinhoWeekBoundaries.ts` — novas janelas com corte de horario
2. `src/hooks/useR2CarrinhoKPIs.ts` — usar janela `aprovados`
3. `src/hooks/useR2CarrinhoData.ts` — usar janela `aprovados` no filtro
4. `src/hooks/useR2CarrinhoVendas.ts` — usar janela `vendasParceria` atualizada

