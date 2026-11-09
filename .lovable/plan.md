# Encaminhamento do Pós-venda: esconder horários já ocupados

## O que foi verificado
- O botão "Agendar em outra BU" abre a mesma tela de agendamento das BUs (Consórcio, War Room, Crédito).
- A lista de horários mostra todos os horários configurados do closer, sem olhar se já existe reunião.
- O sistema só considera "lotado" quando o horário atinge a capacidade do closer — hoje 4 pessoas por horário. Uma reunião com 1 cliente ainda aparece como livre ("1/4 leads").
- Exemplo real: Cleiton Lima (Consórcio) em 10/11 já tem reunião em todos os horários (10h a 20h), e mesmo assim todos aparecem disponíveis.
- A checagem também ignora reuniões canceladas só quando gravadas como "canceled"; as gravadas como "cancelled" contam como ocupadas.

## O que muda (só nos encaminhamentos do Pós-venda)
1. Ao escolher closer e data, o sistema busca as reuniões já marcadas daquele closer no dia.
2. Horários com qualquer reunião ativa (não cancelada, não reagendada) somem da lista. Se não sobrar nenhum, aparece "Nenhum horário livre neste dia".
3. Antes de gravar, uma nova checagem bloqueia o agendamento se outra pessoa ocupou o horário nesse meio-tempo, com o aviso "Este horário já foi ocupado. Escolha outro."
4. Horários de hoje que já passaram também saem da lista.

O agendamento normal das BUs (feito pelos SDRs dentro de cada BU) continua exatamente como está, com as reuniões em grupo de até 4 pessoas.

## Detalhes técnicos
- `QuickScheduleModal`: nova prop opcional `exclusiveSlots?: boolean` (padrão false). Quando true: `useQuery` em `meeting_slots` (closer_id, dia em São Paulo, status not in canceled/cancelled/rescheduled) → filtra `timeSlots`; revalida no submit antes de chamar a criação.
- `EncaminharBuDialog`: passa `exclusiveSlots`.
- Sem migration, sem edge function, sem mudar `useCheckSlotAvailability` nem outros chamadores.
