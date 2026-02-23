

# Remover Efeito Alavanca e Viver de Aluguel, Adicionar "Produtos Fechados" Dinamico

## O que muda

A matriz de metas ficara assim:

```text
METRICA              | DIA  | SEMANA | MES
------------------------------------------
Agendamento          |  ... |  ...   | ...
R1 Agendada          |  ... |  ...   | ...
R1 Realizada         |  ... |  ...   | ...
No-Show              |  ... |  ...   | ...
Proposta Enviada     |  ... |  ...   | ...
--- PRODUTOS FECHADOS ---
Holding              |  ... |  ...   | ...
Reverter             |  ... |  ...   | ...
Aporte Holding       |  ... |  ...   | ...
```

- Remove completamente "Viver de Aluguel" (Contrato Pago, Venda Realizada)
- Remove completamente "Efeito Alavanca + Clube" (Aguardando Doc, Carta Socios, Aporte)
- Mantem "Proposta Enviada" como metrica avulsa (sem grupo)
- Adiciona grupo "Produtos Fechados" com linhas dinamicas baseadas nos produtos cadastrados em `consorcio_produto_adquirido_options`
- Novos produtos adicionados via modal de configuracao aparecem automaticamente

## Arquivos

### 1. Novo: `src/hooks/useConsorcioProdutosFechadosMetrics.ts`

Hook que:
- Busca produtos ativos de `consorcio_produto_adquirido_options`
- Busca registros de `deal_produtos_adquiridos` do mes atual
- Filtra client-side por dia/semana (segunda-domingo)/mes
- Retorna array de `{ id, label, day, week, month }` com contagem por produto

### 2. Atualizar: `src/hooks/useConsorcioPipelineMetrics.ts`

- Remover stages de Viver de Aluguel (`contratoPago`, `vendaRealizada`) e de Efeito Alavanca (`aguardandoDoc`, `cartaSociosFechada`, `aporteHolding`, `cartaAporte`)
- Manter apenas `propostaEnviada` na interface e na query
- Simplificar `PeriodCounts` para ter apenas `propostaEnviada`

### 3. Atualizar: `src/pages/bu-consorcio/PainelEquipe.tsx`

- Importar o novo hook `useConsorcioProdutosFechadosMetrics`
- Remover linhas 474-517 (Viver de Aluguel + Efeito Alavanca)
- Manter "Proposta Enviada" sem `pipelineGroup`
- Adicionar linhas dinamicas do hook, cada uma com `pipelineGroup: 'Produtos Fechados'`
- Targets inicialmente 0 (sem meta), podendo ser expandido futuramente

