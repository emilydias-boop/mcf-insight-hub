# BU - Pós Venda

Nova BU no mesmo molde da BU - Incorporador MCF (mesmo modelo que já foi usado na MCF Solar), começando pelo CRM.

## O que o usuário vai ver
- Novo item no menu: **BU - Pós Venda**, com Visão Geral, Contatos e Negócios (mesmas telas do Incorporador).
- Uma única pipeline, **Relacionamento - Pós venda**, com as etapas:
  1. Reunião de Viabilidade 1
  2. Reunião de Viabilidade 2
  3. Viabilidade Concluída
- **Escolha do destino**: ao arrastar o card para "Viabilidade Concluída", abre uma janela obrigatória em que o gerente escolhe **Crédito Imobiliário (BU Crédito)** ou **Consórcio**. O card é copiado para a BU escolhida, com notas e histórico, e fica registrado para qual BU ele foi. Se a janela for cancelada, o card não muda de etapa.
- **Entregáveis obrigatórios**: cada etapa tem uma lista de entregáveis (PDF da etapa ou conteúdo complementar). O card só avança quando o entregável da etapa atual estiver anexado. Os admins configuram os entregáveis de cada etapa.
- **Anamnese**: o card mostra o botão de anamnese já usado hoje. Se a ficha não estiver preenchida, aparece a tag **"Verificar anamnese no HARVEY"**.
- **Discador e gravações**: os mesmos botões de ligação, auto-discador e gravação de reunião do Incorporador ficam disponíveis nesta BU.

## Quem acessa
- Só **Admin** e o novo perfil **Gerente de Relacionamento** veem e trabalham na BU Pós Venda.
- O perfil novo aparece na gestão de usuários para ser atribuído às pessoas.

## Entrada automática dos clientes
- Só entram compradores de **Vendas MCF (A001, A003, A004, A009)**, com pagamento confirmado, vindos de MCF Pay, Hubla e Kiwify.
- O card é criado (ou reaproveitado, sem duplicar) com nome, telefone, e-mail, produto e valor. As notas e o histórico que o cliente já tem em outras BUs são vinculados ao card, sem serem copiados.
- Essa entrada é **adicional**: o card atual do cliente no Incorporador continua igual.
- **Anamnese**: usa a mesma busca da ficha que hoje acontece na coluna "Encaminhado GR" do Consórcio, mas acionada direto quando o card entra no Pós Venda, sem precisar do envio do GR. Assim que a ficha for preenchida no HARVEY, ela entra no card e a tag some.
- Nada é retroativo: sem carga dos clientes antigos, a menos que você peça.

## Detalhes técnicos
- Perfil: novo valor `gerente_relacionamento` no enum `app_role` (migração), opção em gestão de usuários e prioridade de papel; `role_permissions` com `crm` liberado na BU `pos_venda` só para admin e esse papel.
- BU: `pos_venda` em `BusinessUnit`/`BU_OPTIONS`, `bu_catalog`, `bu_origin_mapping` e no menu; rotas `/pos-venda/crm/*` com `BUCRMLayout bu="pos_venda"` e `RoleGuard ['admin','gerente_relacionamento']`, como na Solar.
- Banco (migração, só estrutura nova): grupo + origin "Relacionamento - Pós venda" + 3 etapas em `crm_origins`/`crm_stages`; tabelas novas `crm_stage_entregaveis` (etapa, tipo pdf/conteúdo, obrigatório) e `crm_deal_entregaveis` (negócio, entregável, arquivo, quem enviou), com RLS para admin/gerente_relacionamento; trigger que bloqueia a mudança de etapa sem os entregáveis obrigatórios; bucket privado para os arquivos.
- Destino: o kanban intercepta a ida para "Viabilidade Concluída" e abre o diálogo; uma RPC nova `pos_venda_concluir_viabilidade(deal_id, bu_destino)` move a etapa, grava `custom_fields.pos_venda_destino` e cria o card na pipeline de entrada da BU Crédito ou Consórcio, reaproveitando o mecanismo atual de replicação de negócios.
- Entrada: nos blocos de pagamento confirmado de `hubla-webhook-handler`, `kiwify` e `mcf-pay-callback`, chamada isolada (try/catch, não derruba o webhook) a uma RPC nova `pos_venda_registrar_cliente(...)`, que deduplica por e-mail minúsculo + 9 últimos dígitos do telefone. Os caminhos atuais dos webhooks não mudam.
- Anamnese: reaproveitar a chamada usada hoje no encaminhamento GR do Consórcio, acionada na entrada do Pós Venda e gravando em `custom_fields.anamnese_v2`; a tag aparece quando `preenchida` é falso ou o dado não existe (`getAnamneseV2`).
- Discador/gravações: liberar os componentes atuais (`QuickDialerLauncher`, `SonaxCallButton`, `useMeetingRecording`) para o novo papel e BU, sem mudar integrações.
- Deploy das três funções de webhook só depois da sua autorização.
