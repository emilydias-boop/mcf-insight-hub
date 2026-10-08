# BU - Pós Venda

Nova BU no mesmo molde da BU - Incorporador MCF (mesmo modelo que já foi usado na MCF Solar), começando pelo CRM.

## O que o usuário vai ver
- Novo item no menu: **BU - Pós Venda**, com Visão Geral, Contatos e Negócios (mesmas telas do Incorporador).
- **Pipeline 1 — Relacionamento - Pós venda**, com as etapas:
  1. Reunião de Viabilidade 1
  2. Reunião de Viabilidade 2
  3. Viabilidade Concluída
- **Pipeline 2 — Encaminhamento (Gerente de Relacionamento)**: quando o card chega em "Viabilidade Concluída", ele passa sozinho para esta pipeline. Nela o gerente escolhe **Enviar para Crédito Imobiliário** ou **Enviar para Consórcio**. O card é copiado para a BU escolhida, com notas e histórico.
- **Entregáveis obrigatórios**: cada etapa tem uma lista de entregáveis (PDF da etapa ou conteúdo complementar). O card só avança quando o entregável da etapa atual estiver anexado. Os admins configuram os entregáveis de cada etapa.
- **Anamnese**: o card mostra o botão de anamnese já usado hoje. Se a ficha não estiver preenchida, aparece a tag **"Verificar anamnese no HARVEY"**.
- **Discador e gravações**: os mesmos botões de ligação, auto-discador e gravação de reunião (MeetGeek/Twilio) do Incorporador ficam disponíveis nesta BU.

## Entrada automática dos clientes
- Só entram compradores de **Vendas MCF (A001, A003, A004, A009)**, com pagamento confirmado, vindos de MCF Pay, Hubla e Kiwify.
- O card é criado (ou reaproveitado, sem duplicar) com nome, telefone, e-mail, produto e valor. As notas e o histórico que o cliente já tem em outras BUs são vinculados ao card, sem serem copiados.
- Essa entrada é **adicional**: o card atual do cliente no Incorporador continua igual.
- **Anamnese**: usa a mesma busca da ficha que hoje acontece na coluna "Encaminhado GR" do Consórcio, mas acionada direto quando o card entra no Pós Venda, sem precisar do envio do GR. Assim que a ficha for preenchida no HARVEY, ela entra no card e a tag some.

## Itens a confirmar antes de construir
- Nome da segunda pipeline (sugestão: "Encaminhamento - Pós venda").
- Quem pode ver e trabalhar nessa BU: quais perfis (gerente de relacionamento, closer, SDR?).
- Se "Crédito Imobiliário" é a BU de Crédito atual.

## Detalhes técnicos
- BU: adicionar `pos_venda` em `BusinessUnit`/`BU_OPTIONS`, `bu_catalog`, `bu_origin_mapping` e no menu; rotas `/pos-venda/crm/*` com `BUCRMLayout bu="pos_venda"`, como na Solar.
- Banco (migração, só estrutura e dados de configuração novos): grupo + 2 origins + etapas em `crm_origins`/`crm_stages`; tabela nova `crm_stage_entregaveis` (etapa, tipo pdf/conteúdo, obrigatório) e `crm_deal_entregaveis` (negócio, entregável, arquivo no storage, quem enviou), com RLS por papel; trigger que bloqueia a mudança de etapa sem os entregáveis obrigatórios.
- Passagem automática: regra em `deal_replication_rules` (Viabilidade Concluída → Pipeline 2). As ações "Enviar para Crédito/Consórcio" usam o mesmo mecanismo de replicação, já existente.
- Entrada: nos blocos de pagamento confirmado de `hubla-webhook-handler`, `kiwify` e `mcf-pay-callback`, chamada isolada (try/catch, não derruba o webhook) a uma RPC nova `pos_venda_registrar_cliente(...)` que deduplica por e-mail minúsculo + 9 últimos dígitos do telefone. Os caminhos atuais dos webhooks não mudam.
- Anamnese: reaproveitar a chamada usada hoje no encaminhamento GR do Consórcio, acionada na entrada do Pós Venda e gravando em `custom_fields.anamnese_v2`; a tag aparece quando `preenchida` é falso ou o dado não existe (`getAnamneseV2`).
- Discador/gravações: liberar os componentes atuais (`QuickDialerLauncher`, `SonaxCallButton`, `useMeetingRecording`) para a BU nova; sem mudar integrações.
- Nada é retroativo: sem carga dos clientes antigos, a menos que você peça.
