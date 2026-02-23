

# Remover "Contrato Pago" e Ajustar "Taxa Venda" na Tabela de Closers do Consorcio

## Contexto

Closers de Consorcio nao vendem "contrato pago" como nas outras BUs. Eles vendem **cartas de consorcio**, e o acompanhamento e feito via "Proposta Fechada" (produtos adquiridos). Portanto, "Contrato Pago" nao faz sentido nesta tabela.

## O que muda

### Layout final da tabela

```text
Closer | R1 Agendada | R1 Realizada | No-show | Proposta Env. | Proposta Fech. | Taxa Venda | >
```

- **Remove** a coluna "Contrato Pago" (nao se aplica ao Consorcio)
- **Ajusta "Taxa Venda"** para usar **Proposta Fechada / R1 Realizada** (em vez de Contrato Pago / R1 Realizada)

## Detalhes tecnicos

### Arquivo: `src/components/sdr/ConsorcioCloserSummaryTable.tsx`

1. Remover o header "Contrato Pago"
2. Remover as celulas de `contrato_pago` (linhas individuais e total)
3. Remover `contrato_pago` do calculo de `totals`
4. Alterar a formula de `taxaVenda` de `contrato_pago / r1_realizada` para `propostasFechadas / r1_realizada`
5. Alterar `totalTaxaVenda` para usar `totalPropostasFechadas / totals.r1_realizada`

