

# Adicionar "Proposta Fechada" e Ajustar Taxas na Tabela de SDRs do Consorcio

## Resumo

Na tabela de SDRs do Painel de Equipe do Consorcio, sera feito:

1. **Adicionar coluna "Proposta Fechada"** - Total de produtos adquiridos (soma de Holding + Reverter + Aporte Holding, etc.) por SDR no periodo
2. **Remover coluna "Taxa Conv."** - Pois a Taxa Venda ja cumpre esse papel
3. **Manter "Taxa Venda"** - Contratos / R1 Realizada (logica atual)

## Layout final da tabela

```text
SDR | Meta | Agendamento | R1 Agendada | R1 Realizada | No-show | Proposta Env. | Proposta Fechada | Taxa Venda | >
```

## Arquivos a modificar

### 1. `src/components/sdr/ConsorcioSdrSummaryTable.tsx`

- Adicionar prop `propostasFechadasBySdr?: Map<string, number>` na interface
- Adicionar coluna "Proposta Fechada" no header (entre "Proposta Env." e "Taxa Venda")
- Renderizar o valor com Badge similar ao de Proposta Env.
- Remover coluna "Taxa Conv." (header e celula)

### 2. `src/pages/bu-consorcio/PainelEquipe.tsx`

- Criar query para buscar contagem de `deal_produtos_adquiridos` por SDR (owner do deal) no periodo selecionado
- Passar o novo Map como prop `propostasFechadasBySdr` para o `ConsorcioSdrSummaryTable`

### Dados de "Proposta Fechada"

A contagem sera feita com join entre `deal_produtos_adquiridos` e `crm_deals` para obter o `owner_id` (email do SDR), agrupando por SDR e contando o total de produtos adquiridos no periodo filtrado.

