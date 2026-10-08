# BU Pós Venda — Fases 2, 3, anamnese própria e agenda de viabilidade

## 1. Entrada automática dos clientes (liberado)
- Ao confirmar o pagamento de A001, A003, A004 ou A009 pelo MCF Pay, Hubla ou Kiwify, o cliente entra na etapa "Reunião de Viabilidade 1" da pipeline Relacionamento - Pós venda.
- O card leva nome, telefone, e-mail, produto, valor, data e plataforma. As notas e o histórico das outras BUs aparecem pelo contato, que é o mesmo.
- Se o cliente já tiver um card no Pós Venda, ele é reaproveitado e não é criado outro. Reembolso, abandono de carrinho e parcelas 2 em diante não criam card.
- **Segurança:** a chamada nova fica isolada. Se ela falhar, só registra o erro, e a venda continua sendo gravada exatamente como hoje. O card do Incorporador não muda.

## 2. Escolha do destino ao chegar em Viabilidade Concluída
- Ao arrastar o card para "Viabilidade Concluída", abre uma janela obrigatória com "Crédito Imobiliário" ou "Consórcio". Se for cancelada, o card não sai do lugar.
- A trava dos entregáveis vale antes da janela: sem os PDFs das reuniões, o card não avança.
- O card novo é criado na BU escolhida, sem dono, para cair na distribuição normal dela, e com a marca "veio do Pós Venda":
  - **Crédito:** PIPELINE CRÉDITO IMOBILIÁRIO, etapa "Em contato".
  - **Consórcio:** PIPE LINE - INSIDE SALES (Consórcio), etapa "Novo Lead".
- O que passa a ser contado lá: esse card entra como lead novo nas contagens daquela pipeline (leads, distribuição e funil), como qualquer lead que chega. Ele não conta como venda nem como reunião.
- O card do Pós Venda fica em Viabilidade Concluída, com o registro de para onde foi, quem enviou e quando.
- Se você quiser outra etapa de entrada no Crédito ou no Consórcio, me diga antes de eu ligar essa parte.

## 3. Recebimento próprio da anamnese (sem o encaminhamento do GR)
- Um endereço novo e separado só para o Pós Venda. O HARVEY envia a ficha com e-mail, telefone ou ID do cliente, e ela é gravada no card do Pós Venda. A tag "Verificar anamnese no HARVEY" some sozinha.
- Se o cliente ainda não tiver card no Pós Venda, a ficha fica guardada e é aplicada quando o card for criado.
- A chave de acesso é a mesma já usada pelo HARVEY hoje. Também posso criar uma chave própria.
- O recebimento atual do Consórcio/GR não é alterado.
- Ao final, entrego um **prompt pronto para colar no HARVEY**, com endereço, cabeçalho, formato da ficha e um exemplo de envio.

## 4. Agenda das Reuniões de Viabilidade
- Nova aba **Agenda** na BU Pós Venda, usando a mesma agenda das outras BUs. Ela tem só dois tipos de reunião: "Reunião de Viabilidade 1" e "Reunião de Viabilidade 2".
- Os gerentes de relacionamento entram como responsáveis pela agenda dessa BU, com horários e link próprios. As agendas R1/R2 das outras BUs não mudam.
- Ao marcar uma reunião, o card não muda de etapa sozinho. O avanço continua sendo pela trava dos entregáveis.
- **Gravações:** as reuniões gravadas pelo MeetGeek passam a se ligar a esses agendamentos pelo e-mail do gerente, como já acontece com os closers. A gravação e o resumo aparecem na reunião.
- **Ponto de atenção:** a agenda e as gravações usam a mesma lista de responsáveis dos closers. Os gerentes ficam marcados como BU Pós Venda, e todos os painéis e rankings de closers já filtram por BU. Antes de cadastrar, confiro se algum painel lista todas as BUs juntas. Se algum listar, paro e aviso você.

## Detalhes técnicos
- RPC `pos_venda_registrar_cliente(p_email, p_phone, p_name, p_product_code, p_amount, p_paid_at, p_fonte, p_transaction_id)`, SECURITY DEFINER, só service_role. Dedup por lower(email) + 9 dígitos do telefone na origin Pós Venda e por `custom_fields.pos_venda_tx`. Aplica a anamnese pendente. Chamada em try/catch nos ramos de pagamento confirmado de `hubla-webhook-handler` (fora de abandono e de parcela > 1), `kiwify-webhook-handler` e `mcf-pay-callback` (ramo venda direta/produtos A001-A009). Deploy das três funções.
- Tabela `pos_venda_anamnese_pendente` (chave e-mail/telefone, payload jsonb, aplicada_em), com RLS e acesso só por service_role. Edge function nova `pos-venda-anamnese`, com validação Zod e o mesmo normalizador `anamnese_v2`. O código é copiado, sem importar do `crm-externo-encaminhamento`, para não alterar aquele arquivo. Grava em `custom_fields.anamnese_v2`.
- RPC `pos_venda_concluir_viabilidade(p_deal_id, p_destino)` (authenticated: admin/gerente_relacionamento). Move a etapa (o trigger de entregáveis continua valendo), cria o deal destino com `custom_fields.origem_pos_venda_deal_id`, grava `custom_fields.pos_venda_destino/_em/_por` e registra em deal_activities. O kanban intercepta o drop só quando `isPosVendaDeal` e o destino for a etapa "Viabilidade Concluída".
- Agenda: rota `pos-venda/crm/agenda` com `BUCRMLayout bu="pos_venda"`. Cadastro dos gerentes em `closers` com `bu='pos_venda'`. Rótulos dos tipos via `meeting_slots.meeting_type` (`r1` = Viabilidade 1, `r2` = Viabilidade 2) só nessa BU, sem tocar nos sincronizadores de etapa R1/R2, que dependem de nomes de etapa que não existem nessa pipeline. RLS de `meeting_slots`/`meeting_recordings` com política adicional para gerente_relacionamento, restrita a closers da BU pos_venda.
