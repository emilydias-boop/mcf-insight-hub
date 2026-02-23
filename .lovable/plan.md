
# Adicionar "Proposta Fechada" e Remover "Taxa Conv." na Tabela de Closers

## Resumo

Aplicar as mesmas alteracoes feitas na tabela de SDRs agora na tabela de Closers:

1. **Adicionar coluna "Proposta Fech."** - Total de produtos adquiridos por Closer no periodo
2. **Remover coluna "Taxa Conv."** - Redundante com Taxa Venda

## Layout final da tabela de Closers

```text
Closer | R1 Agendada | R1 Realizada | No-show | Proposta Env. | Proposta Fech. | Contrato Pago | Taxa Venda | >
```

## Arquivos a modificar

### 1. Novo hook: `src/hooks/useConsorcioProdutosFechadosByCloser.ts`

Criar hook que:
- Busca `deal_produtos_adquiridos` no periodo
- Para cada registro, busca o `deal_id` correspondente em `meeting_slot_attendees` para encontrar o `closer_id` via `meeting_slots`
- Retorna `Map<closer_id, count>`

### 2. `src/components/sdr/ConsorcioCloserSummaryTable.tsx`

- Adicionar prop `propostasFechadasByCloser?: Map<string, number>`
- Adicionar coluna "Proposta Fech." no header (entre "Proposta Env." e "Contrato Pago")
- Renderizar o valor com Badge (estilo verde similar ao SDR)
- Remover coluna "Taxa Conv." (header, celulas individuais e total)
- Remover calculo de `totalTaxaConv` e `taxaConv`

### 3. `src/pages/bu-consorcio/PainelEquipe.tsx`

- Importar `useConsorcioProdutosFechadosByCloser`
- Chamar o hook com as datas do periodo selecionado
- Passar o resultado como prop `propostasFechadasByCloser` para `ConsorcioCloserSummaryTable`
