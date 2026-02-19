

# Alinhar colunas da tabela Closer com a tabela SDR no Painel Consorcio

## Situacao atual

**SDR (correto):** SDR | Meta | Agendamento | R1 Agendada | R1 Realizada | No-show | Proposta Env. | Taxa Venda | Taxa Conv.

**Closer (atual):** Closer | R1 Agendada | Outside | R1 Realizada | No-show | Taxa No-Show | Contrato Pago | R2 Agendada | Taxa Conv.

## Objetivo

Closer deve mostrar as mesmas colunas que SDR:
**Closer | R1 Agendada | R1 Realizada | No-show | Proposta Env. | Contrato Pago | Taxa Venda | Taxa Conv.**

Nota: "Meta" e "Agendamento" nao se aplicam a closers (sao metricas de produtividade SDR). "Outside", "Taxa No-Show" e "R2 Agendada" serao removidos. "Proposta Env." e "Taxa Venda" (Contratos/Realizadas) serao adicionados.

## Detalhes tecnicos

### Criar componente `ConsorcioCloserSummaryTable` 

Novo arquivo: `src/components/sdr/ConsorcioCloserSummaryTable.tsx`

Colunas:
- Closer (nome)
- R1 Agendada (badge azul)
- R1 Realizada (verde)
- No-show (vermelho, com % entre parenteses)
- Proposta Env. (badge roxo - recebido via props, dados do pipeline)
- Contrato Pago (amber)
- Taxa Venda (Contratos / Realizadas x 100)
- Taxa Conv. (Realizadas / Agendadas x 100)
- Chevron de navegacao

Props: aceitar `propostasEnviadasByCloser` (Map de closer_id para contagem de propostas).

### Atualizar `PainelEquipe.tsx`

1. Importar `ConsorcioCloserSummaryTable` no lugar de `CloserSummaryTable`
2. Calcular `propostasEnviadasByCloser` a partir dos dados de pipeline (deals na stage de "Proposta Enviada" agrupados por closer)
3. Passar os dados para o novo componente

O componente CloserSummaryTable original nao sera alterado (e usado por outras BUs).

