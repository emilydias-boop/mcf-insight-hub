# Dono do cartão passa para o Gerente de Relacionamento

## O que foi verificado (sem alterar nada)
- Sim, é possível fazer esse ajuste.
- Hoje, quando a Karen agenda a reunião de viabilidade para um gerente, o sistema grava só o gerente da reunião. O dono do cartão continua sendo a Karen.
- No funil Pós-venda existem cerca de **92 cartões** com a Karen como dona e reunião marcada com outro gerente:
  - Reunião de Viabilidade 1: 64 (28 da Kalyanne, 20 da Rebeca, 15 do William e 1 do Vitor)
  - Reunião de Viabilidade 2: 18 (15 do William e 3 da Rebeca)
  - Viabilidade Concluída: 9, todos do William
  - Novos licenciados: 1, do William
- Também existem cerca de 20 cartões que já pertencem a um gerente, mas cuja última reunião foi feita com outro gerente (exemplo: dono Vitor, reunião com a Kalyanne). Por padrão esses cartões **não** mudam de dono.

## O que será feito
1. **Daqui para frente:** quando uma reunião do Pós-venda for criada ou trocar de gerente, o cartão passa a ter esse gerente como dono. Isso só acontece se o dono atual for a Karen ou se o cartão estiver sem dono. Um cartão que já é de outro gerente continua com ele.
2. **Cartões que já existem:** os ~92 cartões da Karen (e os poucos sem dono) passam para o gerente da reunião mais recente de cada um.
3. A mudança de dono fica registrada no histórico do cartão ("Dono alterado de Karen para <gerente> pela reunião de viabilidade").
4. Fases, etapas, reuniões e as outras BUs não mudam.

## Detalhes técnicos
- Gatilho AFTER INSERT/UPDATE OF gerente_id em pos_venda_reunioes, que atualiza owner_profile_id/owner_id em crm_deals só quando origin_id = POS_VENDA_ORIGIN_ID e o dono atual é a Karen ou nulo. A regra "dono atual é da etapa de admissão" usa a pessoa da distribuição do Pós-venda (pos_venda_distribuicao).
- O backfill usa a reunião mais recente de cada cartão, sem cancelar reuniões, e grava em deal_activities.
