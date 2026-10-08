# Retomar BU Pós Venda — Fases 2, 3, anamnese e agenda

A construção ficou pausada no meio para atender a consulta de leitura. Nada desta etapa foi gravado ainda. O plano aprovado continua o mesmo, com dois ajustes de segurança encontrados na revisão.

## Ajustes encontrados antes de gravar
- **Aviso ao MCF Pay:** hoje, todo card que chega numa etapa marcada como "ganha" envia um aviso automático ao MCF Pay. "Viabilidade Concluída" estava marcada assim. Vou desmarcar, para que concluir a viabilidade não dispare nada para fora.
- **Entrada dos clientes:** em vez de editar as três funções que recebem as vendas (Hubla, Kiwify e MCF Pay), a entrada vai ler as vendas já gravadas, que reúnem as três plataformas. Os webhooks atuais não são alterados nem republicados. Se essa etapa falhar, só registra o erro, e a venda é gravada normalmente.
- **Distribuição no destino:** o card enviado para Crédito ou Consórcio entra sem dono, na etapa de entrada. Ele recebe dono pela distribuição manual da gestão, como os leads sem dono de hoje. Se essa etapa tiver automações de mensagem configuradas, elas disparam como para qualquer lead novo.

## O que será feito (sem mudança em relação ao aprovado)
1. Entrada automática de A001/A003/A004/A009 pagos em "Reunião de Viabilidade 1", sem duplicar o card.
2. Janela obrigatória Crédito/Consórcio ao arrastar para "Viabilidade Concluída". Crédito: etapa "Em contato". Consórcio: etapa "Novo Lead". Se o cliente já tiver card lá, ele é reaproveitado.
3. Recebimento próprio da anamnese do HARVEY, separado do encaminhamento do GR. As fichas que chegam antes do card ficam guardadas. Ao final, entrego o prompt para colar no HARVEY.
4. Agenda das Reuniões de Viabilidade 1 e 2 na BU Pós Venda, com gravações do MeetGeek ligadas pelo e-mail do gerente. Antes, confiro os painéis de closers que juntam todas as BUs e paro se algum for afetado.

## Detalhes técnicos
- `UPDATE crm_stages SET is_won_stage=false` apenas na etapa b05a0001-…-0003, criada por nós.
- Trigger `AFTER INSERT OR UPDATE OF sale_status` em `hubla_transactions` (`pos_venda_on_venda`), com `EXCEPTION WHEN OTHERS`. Só considera completed, primeira parcela, sem order bump e A001/A003/A004/A009. Chama `pos_venda_registrar_cliente`, só service_role.
- `pos_venda_anamnese_pendente`, `pos_venda_aplicar_anamnese_pendente`, `pos_venda_concluir_viabilidade` conforme o plano anterior. Edge function nova `pos-venda-anamnese`.
