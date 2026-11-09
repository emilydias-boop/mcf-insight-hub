# Corrigir erro "crm_deals_data_source_check" ao agendar em outra BU

## Causa (confirmada)
O botão "Agendar em outra BU" cria um cartão na BU de destino marcando a origem como `pos_venda_encaminhamento`. A regra do banco para a origem do negócio só aceita: csv, webhook, manual, bubble, replication. Por isso o cartão é recusado e nada é agendado.

## Correção
Uma migration que só recria a regra `crm_deals_data_source_check`, mantendo os cinco valores atuais e acrescentando `pos_venda_encaminhamento`. Nenhuma função, tela ou outro arquivo muda. Assim o encaminhamento fica identificável nos relatórios (diferente de uma replicação comum).

## Verificação
- Conferir no banco que a regra aceita os seis valores.
- Pedir ao William para repetir o encaminhamento do José Roberto Vieira Guimarães para Consórcio (não consigo testar com o login dele).
