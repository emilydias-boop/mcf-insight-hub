## Plano

1. **Usar a meta mensal do fechamento na tabela de SDRs**
   - Trocar a origem da coluna **Meta** em `/crm/reunioes-equipe`.
   - Em vez de calcular `meta_diaria × dias úteis`, buscar o plano de fechamento vigente do mês selecionado em `sdr_comp_plan`.
   - Exibir diretamente `meta_reunioes_agendadas` do plano vigente do SDR para aquele mês.
   - Isso corrige casos como abril/2026, onde a tela mostra 300/280/240, mas o fechamento configurado tem metas como 190/171/etc.

2. **Remover SDRs desligados fora do período correto**
   - Ajustar a lista de SDRs válidos do período para considerar `employees.status` e `employees.data_demissao`.
   - Um SDR só deve aparecer se estava ativo em algum momento dentro do período selecionado.
   - Como a Juliana tem `data_demissao = 2026-03-23`, ela não deve aparecer em abril/2026 nem meses posteriores.

3. **Corrigir a base histórica do squad**
   - Atualizar a lógica/RPC `get_sdrs_for_squad_in_period` para não considerar histórico aberto (`valid_to null`) de SDR desligado como se ainda estivesse ativo.
   - Quando houver desligamento, o fim efetivo do vínculo passa a ser a `data_demissao`.
   - Também filtrar perfis desativados para não voltarem na foto atual da equipe.

4. **Manter métricas e totais alinhados com o que é exibido**
   - Garantir que cards, total da tabela e contagem de SDRs continuem usando apenas os SDRs válidos no período.
   - Não alterar a regra de cálculo de agendamentos, R1, no-show ou contratos; apenas a meta exibida e a elegibilidade do SDR na lista.

## Detalhes técnicos

- Arquivos prováveis:
  - `src/pages/crm/ReunioesEquipe.tsx`
  - `src/components/sdr/SdrSummaryTable.tsx`
  - `src/hooks/useSdrsFromSquad.ts`
  - `src/hooks/useSdrsForSquadInPeriod.ts` se necessário
- Banco:
  - Migration para ajustar a função `public.get_sdrs_for_squad_in_period`.
- Fonte da meta:
  - `sdr_comp_plan.meta_reunioes_agendadas`, filtrando por vigência do mês selecionado.
- Fonte de desligamento:
  - `employees.data_demissao` e `employees.status` vinculados por `employees.sdr_id = sdr.id`.