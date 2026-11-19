# Gravação na reunião realizada + nota automática no encaminhamento ao Consórcio

## O que o gerente vai ver

1. **Agenda de reuniões do Pós-venda → abrir reunião realizada**
   - Nova seção "Gravação MeetGeek" com duas abas: **Resumo** (resumo + próximos passos, texto limpo) e **Transcrição** (falas com quem falou e horário, com busca).
   - Trechos com palavras-chave de Consórcio aparecem destacados.
   - Sem gravação associada: aviso "Nenhuma gravação encontrada para esta reunião".

2. **Encaminhar para a BU Consórcio**
   - O campo **Notas** já vem preenchido com os trechos da transcrição que citam: carta de crédito, consórcio, renda passiva, locação de imóvel, alavancagem com consórcio, crédito imobiliário com consórcio (com pequenas variações, ex.: "carta", "alavancar", "aluguel", sem diferenciar acentos).
   - Cada trecho vem com a data da reunião e algumas frases ao redor para dar contexto. O gerente pode editar.
   - **Sem trechos encontrados:** o campo vem vazio, obrigatório, com o texto de orientação:
     "Informe o motivo pelo qual você está encaminhando este cliente para a BU Consórcio (interesse demonstrado, objetivo do cliente, perfil financeiro…). Esta justificativa é obrigatória."
   - Mínimo de 20 caracteres continua valendo; o botão "Agendar Reunião" só libera com a justificativa.
   - Considera as reuniões realizadas do cliente no Pós-venda (a mais recente primeiro).

3. Encaminhamentos para outras BUs (War Room, Crédito) e o agendamento normal das demais BUs ficam como estão.

## Detalhes técnicos

- **Leitura da gravação:** nova função SQL `pos_venda_gravacao_reuniao(p_reuniao_id)` (SECURITY DEFINER, leitura, só quem pode ver a reunião no Pós-venda), reutilizando a mesma regra de associação de `pos_venda_registrar_resumo` (gerente host/participante, e-mail do cliente, ±3h). Retorna resumo limpo (`pos_venda_html_texto`), próximos passos e transcrição. Evita abrir RLS de `meeting_recordings`.
- **Trechos de Consórcio:** nova função `pos_venda_trechos_consorcio(p_deal_id)` que varre as transcrições das reuniões realizadas do negócio e retorna trechos (frase alvo ± 1 fala) por palavra-chave normalizada (unaccent/lower), deduplicados e limitados (~8 trechos / ~2.000 caracteres).
- **Front:**
  - `AgendaPosVenda.tsx` (`ReuniaoDialog`): seção de gravação quando status = realizada, novo hook `usePosVendaGravacao`.
  - `EncaminharBuDialog.tsx`: quando a BU destino for Consórcio, busca os trechos e passa como `prefilledNotes`; senão passa vazio + novo prop `notesPlaceholder` / `notesHelp`.
  - `QuickScheduleModal.tsx`: apenas aceitar `notesPlaceholder` opcional (sem mudar comportamento das outras BUs).
- Lista de palavras-chave fica em um único lugar (função SQL) para ajustar depois.
- Teste de unidade para a regra "sem trecho → notas vazias e obrigatórias".
