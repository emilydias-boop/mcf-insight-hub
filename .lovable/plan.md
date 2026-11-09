# Agendar reunião em outra BU a partir do Pós-venda

## Como está hoje
- O gerente de relacionamento só agenda reuniões de Viabilidade 1 e 2 na agenda do Pós-venda.
- Não existe um botão para marcar uma reunião do cliente com um closer de Consórcio, War Room (Solar) ou Crédito.
- "Mover para outra pipeline" tira o cliente do Pós-venda e não marca reunião, então não serve para isso.

## O que será feito
1. **Botão "Agendar em outra BU"**
   - Aparece no cliente do Pós-venda: na janela da reunião da agenda e no cartão do cliente.
   - Só o gerente de relacionamento e o admin veem esse botão.
2. **Escolher a BU**: Consórcio, War Room (Solar) ou Crédito.
3. **Escolher closer e horário**
   - Abre a mesma tela de agendamento que a BU de destino já usa, com os closers e os horários livres dela.
   - A reunião entra como R1 Agendada na agenda dessa BU.
4. **Cópia do cliente na outra BU**
   - Se o cliente ainda não tem cartão no funil de destino, um cartão novo é criado lá, em "R1 Agendada".
   - Se já tem, a reunião é marcada nesse cartão; nada é duplicado.
   - O cartão do Pós-venda continua onde está.
5. **Registro no cartão do Pós-venda**
   - Ganha a etiqueta "Encaminhado: Consórcio", "Encaminhado: War Room" ou "Encaminhado: Crédito".
   - Ganha uma linha na linha do tempo: "Reunião agendada em {BU} com {closer} para {data/hora}", com o nome do gerente.
6. **Trilha e jornada do parceiro**
   - O encaminhamento fica gravado como atividade do cliente, para alimentar a jornada calculada e o link público de consulta.
   - As regras atuais da jornada não mudam.
7. **Crédito da venda**: nada muda. A venda segue as regras de atribuição de cada BU, sem marcar o gerente como origem.

## Fora do escopo
- Incorporador.
- Comissão ou crédito da venda para o gerente.
- Mudança nas agendas das outras BUs, nas métricas de SDR/closer ou na distribuição de leads.

## A confirmar antes de construir
- **Fase da jornada:** em qual fase o encaminhamento deve aparecer. Sem essa definição, ele entra só como evento registrado, sem mudar a fase.
- **Closers:** se a War Room e o Crédito devem mostrar todos os closers da BU ou só alguns.

## Detalhes técnicos
- A agenda de destino usa meeting_slots/closers via QuickScheduleModal. A BU vem como parâmetro (bu de destino), sem depender do useActiveBU, para não afetar o comportamento atual em outras telas.
- Uma RPC nova, `pos_venda_encaminhar_bu(p_deal_id, p_bu)`:
  - valida o papel `gerente_relacionamento` ou `admin`;
  - procura um negócio no funil de destino pela origem de bu_origin_mapping, deduplicando por lower(email) e pelo sufixo de 9 dígitos do telefone;
  - cria o negócio se não existir;
  - grava a etiqueta e o evento (deal_activities com metadata `{tipo: 'encaminhamento_bu', bu, deal_destino_id}`) e o registro em crm_cliente_timeline;
  - devolve o deal_destino_id.
- Ordem do fluxo: RPC → QuickScheduleModal(dealId = deal_destino_id, bu de destino).
- Bloqueios preservados: um parceiro A001–A009 não entra na Inside Sales (só relevante se no futuro incluir o Incorporador). O A010 não é afetado.
- Migration só com a função nova. Nada muda em tabelas, triggers ou edge functions já existentes.
