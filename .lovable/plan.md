# Encaminhamento Pós-venda → Consórcio: contexto destacado para o closer

## Objetivo
Quando um gerente de relacionamento encaminha um cliente para o Consórcio, o closer deve ver, em destaque, tudo o que foi conversado: resumo da reunião de viabilidade (MeetGeek), trechos da transcrição e a nota do encaminhamento.

## O que o closer vai ver
1. **Bloco "Encaminhado pelo Pós-venda"** no topo do cartão do cliente no CRM do Consórcio e no detalhe da reunião R1 agendada:
   - Quem encaminhou (gerente), data e horário da reunião de viabilidade.
   - **Nota do encaminhamento** (motivo escrito pelo gerente) em destaque.
   - **Resumo da reunião** do gerente (conversa e próximos passos) limpo, sem HTML.
   - **Trechos da transcrição** com termos de consórcio destacados (carta de crédito, renda passiva, alavancagem etc.).
   - Botão "Ver transcrição completa" que abre a transcrição inteira com busca.
2. Selo visual "Pós-venda" no cartão do kanban do Consórcio para identificar encaminhamentos rapidamente.
3. Se a reunião não tiver gravação, o bloco mostra só a nota do encaminhamento e o aviso "Reunião sem gravação associada".

## Regras
- Aparece apenas em cartões do Consórcio que vieram de encaminhamento do Pós-venda; demais cartões e BUs ficam iguais.
- Somente leitura: nada da jornada, dono do cartão ou agendas muda.
- Vale para encaminhamentos novos e para os já feitos (buscando o histórico existente).

## Detalhes técnicos
- Nova função de leitura `pos_venda_contexto_encaminhamento(p_deal_id)` (SECURITY DEFINER, EXECUTE para authenticated): a partir do cartão destino, localiza o registro de encaminhamento em `crm_cliente_timeline`/`deal_activities`, o cartão Pós-venda de origem, a última reunião de viabilidade realizada em `pos_venda_reunioes`, a gravação MeetGeek associada (resumo/próximos passos/transcrição) e a nota da R1 criada no encaminhamento. Reaproveita a lógica de trechos de `pos_venda_trechos_consorcio`.
- Novo componente `EncaminhamentoPosVendaCard` montado no `DealDetailsDrawer` e no drawer de reunião R1 apenas quando a função retornar dados; selo no card do kanban via a mesma consulta em lote (uma por tela).
- A nota escrita no encaminhamento passa a ser salva também como atividade marcada (`metadata.tipo='encaminhamento_pos_venda'`) no cartão destino, para não depender só da nota da reunião.
- Teste da regra de montagem do contexto (com/sem gravação) junto aos testes existentes de `posVendaConsorcioNota`.
