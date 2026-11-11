# Jornada do cliente atualizada pelas reuniões do Pós-venda

## O que muda para quem usa
- Quando uma Reunião de Viabilidade do Pós-venda for marcada como **Realizada**, o cartão do cliente avança sozinho para a etapa correspondente (Viabilidade 1 -> etapa da Viabilidade 1; Viabilidade 2 -> etapa seguinte), e a consulta externa por CPF (trilha.mcfcapital.com.br/jornada) já mostra a nova fase com a data.
- Assim que a gravação do MeetGeek daquela reunião ficar pronta, o resumo vira uma **nota no cartão do cliente**: "Resumo da reunião" + "Próximos passos", em texto limpo (sem os códigos que aparecem hoje no print).
- A consulta por CPF passa a mostrar, para o cliente, a data da última reunião e os **próximos passos** combinados (o resumo completo fica só no CRM, por ser conversa interna).
- Na tela da reunião, o resumo das gravações deixa de aparecer com códigos (strong, href, mailto) e passa a aparecer formatado.

## Regras
- Só vale para reuniões e cartões do Pós-venda; outras BUs e agendas não mudam.
- Cartão nunca volta de etapa: se o cliente já estiver mais adiante, só a nota e a data são registradas.
- Uma nota por reunião (reprocessar a gravação não duplica).
- Gravação liga à reunião pelo e-mail do cliente + horário próximo (até 3 h de diferença) com o gerente da reunião.
- Desmarcar "Realizada" não apaga nota nem desfaz a etapa (fica no histórico).

## Detalhes técnicos
- Trigger em pos_venda_reunioes (status -> realizada): resolve etapa via jornada_mapa_estagios conforme tipo, move crm_deals com set_config mcf.mov_contexto e registra deal_activities stage_change (jornada_calcular já lê isso).
- Função pos_venda_registrar_resumo(reuniao_id): busca a gravação MeetGeek casada, remove HTML, extrai seção de próximos passos (ou gera com a IA já usada na meetgeek-analisar), insere deal_activities activity_type='pos_venda_resumo_reuniao' com metadata {reuniao_id, gravacao_id, proximos_passos}; idempotente por reuniao_id. Chamada pelo trigger e após a chegada/análise da gravação.
- jornada_calcular/consultar-jornada: incluir ultima_reuniao {data, tipo, proximos_passos}; teste em consultar-jornada/index_test.ts.
- Drawer da reunião (AgendaPosVenda): renderizar resumo sanitizado em vez de texto cru.
- Backfill opcional das reuniões já realizadas (ex.: Mauro Elias, Rogério Cardozo, Diego Colognesi) depois de simular.
